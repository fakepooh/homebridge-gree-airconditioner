import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import hap from '@homebridge/hap-nodejs';
import crypto from '../dist/crypto.js';
import { GreeACPlatform } from '../dist/platform.js';
import { DeviceSession } from '../dist/deviceSession.js';

const key = '0123456789abcdef';
const mac = '001122334455';
const rinfo = { address: '192.0.2.1', port: 7000, family: 'IPv4', size: 0 };
function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const directory = mkdtempSync(join(tmpdir(), 'gree-message-test-'));
  writeFileSync(join(directory, 'config.json'), '{"platforms":[]}');
  t.after(() => rmSync(directory, { recursive: true }));
  const logs = [];
  const log = Object.fromEntries(['debug', 'warn', 'error', 'info', 'success'].map((name) => [name, (...args) => logs.push(args)]));
  const platform = new GreeACPlatform(log, {}, { hap, on: () => {}, user: { configPath: () => join(directory, 'config.json') } });
  let initialized = 0, updates = 0;
  const ac = {
    accessory: { bound: false, context: { device: { mac, ...rinfo, encryptionVersion: 1 } } },
    deviceConfig: { statusUpdateInterval: 10 },
    getDeviceLabel: () => mac,
    initAccessory: () => initialized++,
    handleMessage: () => updates++,
  };
  ac.session = new DeviceSession(10000, () => {
    ac.key = undefined;
  }, () => {}, () => {
    ac.accessory.bound = false;
  });
  ac.session.start(); t.after(() => ac.session.close());
  const send = (pack, bound = false, info = rinfo, version = 1) => {
    const body = version === 1 ? { pack: crypto.encrypt_v1(pack, bound ? key : undefined) } :
      crypto.encrypt_v2(pack, bound ? key : undefined);
    platform.handleACMessage(ac, Buffer.from(JSON.stringify({ ...body, i: bound ? 0 : 1 })), info);
  };
  return { platform, ac, send, logs, initialized: () => initialized, updates: () => updates };
}

test('binding requires a matching acknowledgement and decrypted status, initializes only once across recovery', (t) => {
  const f = fixture(t);
  f.send({ t: 'bindok', mac, key });
  assert.equal(f.ac.accessory.bound, false);
  f.send({ t: 'dat', mac, cols: ['Pow'], dat: [0] }, true);
  assert.equal(f.ac.accessory.bound, true);
  assert.equal(f.initialized(), 1);
  assert.equal(f.updates(), 1);
  f.ac.session.transportFailed();
  f.send({ t: 'bindok', mac, key });
  f.send({ t: 'dat', mac, cols: ['Pow'], dat: [0] }, true);
  assert.equal(f.initialized(), 1);
  assert.equal(f.updates(), 2);
  assert.ok(!JSON.stringify(f.logs).includes(key));
});

test('malformed packets, wrong source and forged status cannot bind or reset health', (t) => {
  const f = fixture(t);
  assert.doesNotThrow(() => f.platform.handleACMessage(f.ac, Buffer.from('{'), rinfo));
  f.send({ t: 'bindok', mac: 'ffffffffffff', key });
  assert.equal(f.ac.key, undefined);
  f.send({ t: 'bindok', mac, key }, false, { ...rinfo, port: 7001 });
  assert.equal(f.ac.key, undefined);
  f.send({ t: 'bindok', mac, key });
  f.send({ t: 'dat', mac, cols: ['Pow'], dat: [0] });
  f.send({ t: 'dat', mac, cols: ['Pow'], dat: [] }, true);
  f.send({ t: 'dat', mac, cols: ['Pow'], dat: ['invalid'] }, true);
  assert.equal(f.ac.accessory.bound, false);
  assert.equal(f.updates(), 0);
});

test('a late alternate-encryption bind response selects its actual packet version', (t) => {
  const f = fixture(t);
  t.mock.timers.tick(29000);
  f.send({ t: 'bindok', mac, key }, false, rinfo, 2);
  assert.equal(f.ac.accessory.context.device.encryptionVersion, 2);
  f.send({ t: 'dat', mac, cols: ['Pow'], dat: [0] }, true, rinfo, 2);
  assert.equal(f.ac.accessory.bound, true);
});

test('real full status permits the device time string and unsupported null fields', (t) => {
  const f = fixture(t);
  f.send({ t: 'bindok', mac, key });
  f.send({ t: 'dat', mac, cols: ['Pow', 'time', 'TemSen'], dat: [0, '2026-10-09 01:18:00', null] }, true);
  assert.equal(f.ac.accessory.bound, true);
  assert.equal(f.updates(), 1);
});

for (const version of [1, 2]) {
  test(`command responses require the session key and typed values (protocol ${version})`, (t) => {
    const f = fixture(t);
    f.send({ t: 'bindok', mac, key }, false, rinfo, version);
    f.send({ t: 'dat', mac, cols: ['Pow'], dat: [0] }, true, rinfo, version);
    assert.equal(f.updates(), 1);
    // An otherwise valid acknowledgement encrypted with the public bind key is untrusted.
    f.send({ t: 'res', opt: ['Pow'], val: [1] }, false, rinfo, version);
    for (const pack of [
      { opt: ['Pow'], val: [] }, { opt: [7], val: [1] },
      { opt: ['Pow'], val: ['1'] }, { opt: ['Pow'], val: [null] },
      { opt: ['Pow'], val: [{}] }, { opt: [], val: [] },
      { opt: ['Pow'], p: null, val: [1] }, { opt: ['Pow'], p: [], val: [1] },
    ]) {
      f.send({ t: 'res', ...pack }, true, rinfo, version);
    }
    assert.equal(f.updates(), 1);
    f.send({ t: 'res', opt: ['Pow'], val: [1] }, true, rinfo, version);
    f.send({ t: 'res', opt: ['Mod'], p: [4] }, true, rinfo, version);
    assert.equal(f.updates(), 3);
    assert.ok(!JSON.stringify(f.logs).includes(key));
  });
}

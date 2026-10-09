import assert from 'node:assert/strict';
import test from 'node:test';
import { DeviceSession } from '../dist/deviceSession.js';
import { GreeAirConditioner } from '../dist/platformAccessory.js';

function fixture(t, interval = 10000) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const binds = [], polls = [], unavailable = [];
  const session = new DeviceSession(interval, (alternate) => binds.push(alternate),
    () => polls.push(Date.now()), () => unavailable.push(Date.now()));
  return { session, binds, polls, unavailable };
}

test('a failed startup keeps retrying both protocols at a bounded rate; repeated start is inert', (t) => {
  const { session, binds } = fixture(t);
  session.start(); session.start();
  assert.deepEqual(binds, [false]);
  t.mock.timers.tick(29000);
  assert.deepEqual(binds, [false, true]);
  t.mock.timers.tick(29000);
  assert.equal(binds.length, 3);
  t.mock.timers.tick(59999);
  assert.equal(binds.length, 3);
  t.mock.timers.tick(1);
  assert.equal(binds.length, 4);
  session.close(); t.mock.timers.tick(3600000);
  assert.equal(binds.length, 4);
});

test('bind acknowledgement alone is not healthy and duplicates cannot extend the status deadline', (t) => {
  const { session, binds, polls } = fixture(t);
  assert.equal(session.statusReceived(), false);
  session.start();
  assert.equal(session.bindingAccepted(), true);
  t.mock.timers.tick(20000);
  assert.equal(session.bindingAccepted(), false);
  assert.equal(polls.length, 1);
  t.mock.timers.tick(9000);
  assert.equal(binds.length, 2);
  session.close();
});

test('status responses preserve a single polling timer; sustained silence starts rebind', (t) => {
  const { session, binds, polls } = fixture(t);
  session.start(); session.bindingAccepted(); session.statusReceived();
  for (let i = 0; i < 4; i++) {
    t.mock.timers.tick(10000); session.statusReceived(); session.statusReceived();
  }
  assert.equal(polls.length, 5);
  for (let i = 0; i < 9; i++) {
    t.mock.timers.tick(10000);
  }
  assert.equal(binds.length, 2);
  assert.equal(session.statusReceived(), false);
  session.bindingAccepted(); session.statusReceived();
  t.mock.timers.tick(10000);
  assert.equal(polls.length, 15);
  session.close();
});

test('send errors trigger one recovery, and close prevents late callbacks from restarting it', (t) => {
  const { session, binds } = fixture(t);
  session.start(); session.bindingAccepted(); session.statusReceived();
  session.transportFailed(); session.transportFailed();
  assert.equal(binds.length, 2);
  session.close(); session.transportFailed(); session.start();
  t.mock.timers.tick(300000);
  assert.equal(binds.length, 2);
});

test('the actual send method observes asynchronous EHOSTUNREACH without logging a key', () => {
  const messages = []; let callback; let recoveries = 0;
  const handler = Object.create(GreeAirConditioner.prototype);
  handler.accessory = { context: { device: { mac: '001122334455', address: '192.0.2.1', port: 7000, encryptionVersion: 1 } } };
  handler.platform = { log: { debug: () => {}, warn: (...args) => messages.push(args), error: (...args) => messages.push(args) } };
  handler.socket = { send: (...args) => {
    callback = args.at(-1);
  } };
  handler.session = { transportFailed: () => recoveries++ };
  handler.key = '0123456789abcdef';
  handler.sendMessage({ t: 'status', cols: ['Pow'] });
  assert.equal(typeof callback, 'function');
  callback(Object.assign(new Error('send failed'), { code: 'EHOSTUNREACH' }));
  assert.equal(recoveries, 1);
  assert.match(JSON.stringify(messages), /EHOSTUNREACH/);
  assert.ok(!JSON.stringify(messages).includes(handler.key));
  callback(null);
  assert.equal(recoveries, 1);
});

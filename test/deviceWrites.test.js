import assert from 'node:assert/strict';
import test from 'node:test';
import hap from '@homebridge/hap-nodejs';
import crypto from '../dist/crypto.js';
import { DeviceSession } from '../dist/deviceSession.js';
import { GreeAirConditioner } from '../dist/platformAccessory.js';
import { DEFAULT_DEVICE_CONFIG } from '../dist/settings.js';
import { FEATURE_SWITCH_SERVICES } from '../dist/featureSwitches.js';

test('real HomeKit write handlers reject unavailable sessions before changing preferences or pending commands', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const accessory = new hap.Accessory('Test AC', hap.uuid.generate('gree-recovery-writes'));
  accessory.addService(hap.Service.HeaterCooler, 'Test AC')
    .setCharacteristic(hap.Characteristic.CoolingThresholdTemperature, 16)
    .setCharacteristic(hap.Characteristic.HeatingThresholdTemperature, 16);
  accessory.registered = true;
  accessory.context = { device: { mac: '001122334455', address: '192.0.2.1', port: 7000, encryptionVersion: 1 } };
  const sent = [];
  const log = Object.fromEntries(['debug', 'warn', 'error', 'info', 'success'].map(name => [name, () => {}]));
  const platform = { log, Service: hap.Service, Characteristic: hap.Characteristic,
    api: { hap, updatePlatformAccessories: () => {} } };
  const ac = new GreeAirConditioner(platform, accessory,
    { ...DEFAULT_DEVICE_CONFIG, fanControlEnabled: true, featureSwitches: { light: true } }, '',
    { send: (body, port, address, callback) => {
      sent.push(JSON.parse(body)); callback(null);
    } });
  ac.status = { Pow: 0, Mod: 1, Lig: 0 };
  ac.session = new DeviceSession(10000, () => {
    ac.key = undefined;
  }, () => {}, () => {
    accessory.bound = false;
  });
  t.after(() => ac.session.close());
  ac.initAccessory();
  const hc = accessory.getService(hap.Service.HeaterCooler);
  const light = accessory.getServiceById(hap.Service.Switch, FEATURE_SWITCH_SERVICES.light.subtype);
  const services = accessory.services.map(s => [s.UUID, s.subtype]);
  const context = JSON.parse(JSON.stringify(accessory.context));
  const unavailable = code => code === hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE;
  const rejectedWrites = async () => {
    await assert.rejects(hc.getCharacteristic(hap.Characteristic.Active).handleSetRequest(0), unavailable);
    await assert.rejects(hc.getCharacteristic(hap.Characteristic.TargetHeaterCoolerState).handleSetRequest(2), unavailable);
    await assert.rejects(hc.getCharacteristic(hap.Characteristic.RotationSpeed).handleSetRequest(4), unavailable);
    await assert.rejects(light.getCharacteristic(hap.Characteristic.On).handleSetRequest(true), unavailable);
    assert.throws(() => ac.sendCommand({ Pow: 1, Mod: 4 }), error => error.hapStatus === hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    assert.throws(() => ac.sendMessage({ t: 'cmd', opt: ['Lig'], p: [1] }),
      error => error.hapStatus === hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    assert.equal(ac.powerPending, -1);
    assert.equal(ac.modePending, -1);
    assert.deepEqual(accessory.context, context);
    assert.deepEqual(accessory.services.map(s => [s.UUID, s.subtype]), services);
  };
  ac.session.start();
  await rejectedWrites();
  assert.equal(sent.length, 0);
  ac.key = '0123456789abcdef';
  ac.session.bindingAccepted();
  await rejectedWrites(); // Bind acknowledgement without status is still unavailable.
  ac.session.statusReceived(); accessory.bound = true;
  await light.getCharacteristic(hap.Characteristic.On).handleSetRequest(true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].i, 0);
  assert.deepEqual(crypto.decrypt_v1(sent[0].pack, ac.key), { t: 'cmd', opt: ['Lig'], p: [1] });
  ac.session.transportFailed();
  await rejectedWrites();
  assert.equal(sent.length, 1);
  // Recovery protocol traffic remains possible, while control traffic is blocked.
  ac.sendMessage({ t: 'bind', mac: accessory.context.device.mac, uid: 0 });
  assert.equal(sent.at(-1).i, 1);
  ac.key = '0123456789abcdef';
  ac.sendMessage({ t: 'status', cols: ['Pow'] });
  assert.equal(sent.at(-1).i, 0);
  ac.session.bindingAccepted(); ac.session.statusReceived(); accessory.bound = true;
  await light.getCharacteristic(hap.Characteristic.On).handleSetRequest(false);
  assert.equal(sent.at(-1).i, 0);
  assert.deepEqual(crypto.decrypt_v1(sent.at(-1).pack, ac.key), { t: 'cmd', opt: ['Lig'], p: [0] });
  ac.session.close();
  await rejectedWrites();
  // Local service metadata remains writable while the device is unavailable.
  await light.getCharacteristic(hap.Characteristic.ConfiguredName).handleSetRequest('Local Light');
  assert.equal(light.getCharacteristic(hap.Characteristic.ConfiguredName).value, 'Local Light');
});

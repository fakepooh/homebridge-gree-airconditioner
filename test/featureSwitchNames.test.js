import assert from 'node:assert/strict';
import test from 'node:test';
import hap from '@homebridge/hap-nodejs';

import { GreeAirConditioner } from '../dist/platformAccessory.js';
import { FEATURE_SWITCHES, FEATURE_SWITCH_SERVICES } from '../dist/featureSwitches.js';

const { Accessory, Characteristic, Service, uuid } = hap;

function initialize(accessory, save = () => {}) {
  const handler = Object.create(GreeAirConditioner.prototype);
  handler.accessory = accessory;
  handler.platform = { Service, Characteristic, api: { updatePlatformAccessories: save } };
  handler.deviceConfig = { featureSwitches: Object.fromEntries(FEATURE_SWITCHES.map((name) => [name, true])) };
  handler.featureSwitchServices = {};
  handler.initFeatureSwitchServices();
  return handler;
}

test('new and legacy switches expose writable names without replacing their services', () => {
  const accessory = new Accessory('Test AC', uuid.generate('feature-switch-names'));
  const legacy = accessory.addService(Service.Switch, 'GREE Light', FEATURE_SWITCH_SERVICES.light.subtype);
  initialize(accessory);
  assert.equal(accessory.getServiceById(Service.Switch, FEATURE_SWITCH_SERVICES.light.subtype), legacy);
  for (const name of FEATURE_SWITCHES) {
    const service = accessory.getServiceById(Service.Switch, FEATURE_SWITCH_SERVICES[name].subtype);
    const configuredName = service.getCharacteristic(Characteristic.ConfiguredName);
    assert.equal(configuredName.value, FEATURE_SWITCH_SERVICES[name].displayName);
    assert.ok(configuredName.props.perms.includes(hap.Perms.PAIRED_WRITE));
  }
});

test('HomeKit name writes persist in the cache and survive restart independently per service and device', async () => {
  const accessory = new Accessory('Test AC', uuid.generate('feature-switch-rename'));
  let saved;
  const handler = initialize(accessory, (accessories) => {
    assert.deepEqual(accessories, [accessory]);
    saved = Accessory.serialize(accessory);
  });
  const configuredName = handler.featureSwitchServices.quiet.getCharacteristic(Characteristic.ConfiguredName);
  await configuredName.handleSetRequest('Bedroom Quiet');
  assert.equal(configuredName.value, 'Bedroom Quiet');
  const restored = Accessory.deserialize(saved);
  initialize(restored);
  initialize(restored);
  assert.equal(restored.services.filter((service) => service.UUID === Service.Switch.UUID).length, 6);
  assert.equal(restored.getServiceById(Service.Switch, FEATURE_SWITCH_SERVICES.quiet.subtype)
    .getCharacteristic(Characteristic.ConfiguredName).value, 'Bedroom Quiet');
  assert.equal(restored.getServiceById(Service.Switch, FEATURE_SWITCH_SERVICES.light.subtype)
    .getCharacteristic(Characteristic.ConfiguredName).value, 'Light');

  const other = new Accessory('Other AC', uuid.generate('feature-switch-other'));
  initialize(other);
  assert.equal(other.getServiceById(Service.Switch, FEATURE_SWITCH_SERVICES.quiet.subtype)
    .getCharacteristic(Characteristic.ConfiguredName).value, 'Quiet');
  await assert.rejects(configuredName.handleSetRequest(''));
  assert.equal(configuredName.value, 'Bedroom Quiet');
});

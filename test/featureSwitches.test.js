import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FEATURE_SWITCHES,
  FEATURE_SWITCH_DEFAULTS,
  FEATURE_SWITCH_SERVICES,
  featureSwitchCommand,
  mergeFeatureSwitchConfig,
  projectFeatureSwitch,
} from '../dist/featureSwitches.js';
import { DEFAULT_DEVICE_CONFIG } from '../dist/settings.js';

test('Auto Fan reflects only explicitly reported Auto speed and gives Turbo precedence', () => {
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 0, Tur: 0 }), true);
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 0, Tur: 1 }), false);
  for (const speed of [1, 2, 3, 4, 5]) {
    assert.equal(projectFeatureSwitch('autoFan', { WdSpd: speed, Tur: 0 }), false);
  }
  assert.equal(projectFeatureSwitch('autoFan', { Tur: 0 }), undefined);
});

test('Quiet is a momentary action and OFF requests no command', () => {
  assert.equal(projectFeatureSwitch('quiet', {}), false);
  assert.equal(projectFeatureSwitch('quiet', { Quiet: 2, WdSpd: 1 }), false);
  assert.deepEqual(featureSwitchCommand('quiet', true), { Quiet: 2 });
  assert.deepEqual(featureSwitchCommand('quiet', false), {});
});

test('Turbo changes Tur only and projects reported state', () => {
  assert.equal(projectFeatureSwitch('powerful', { Tur: 1 }), true);
  assert.equal(projectFeatureSwitch('powerful', { Tur: 0 }), false);
  assert.equal(projectFeatureSwitch('powerful', {}), undefined);
  assert.deepEqual(featureSwitchCommand('powerful', true), { Tur: 1 });
  assert.deepEqual(featureSwitchCommand('powerful', false), { Tur: 0 });
});

test('X-Fan, Health, and Light project raw values and write only their own property', () => {
  for (const [name, property] of [['xFan', 'Blo'], ['health', 'Health'], ['light', 'Lig']]) {
    assert.equal(projectFeatureSwitch(name, { [property]: 1 }), true);
    assert.equal(projectFeatureSwitch(name, { [property]: 0 }), false);
    assert.equal(projectFeatureSwitch(name, {}), undefined);
  }
  assert.deepEqual(featureSwitchCommand('xFan', true), { Blo: 1 });
  assert.deepEqual(featureSwitchCommand('xFan', false), { Blo: 0 });
  assert.deepEqual(featureSwitchCommand('health', true), { Health: 1 });
  assert.deepEqual(featureSwitchCommand('health', false), { Health: 0 });
  assert.deepEqual(featureSwitchCommand('light', true), { Lig: 1 });
  assert.deepEqual(featureSwitchCommand('light', false), { Lig: 0 });
});

test('feature switch configuration defaults off and merges each device override independently', () => {
  assert.deepEqual(mergeFeatureSwitchConfig(), FEATURE_SWITCH_DEFAULTS);
  assert.deepEqual(mergeFeatureSwitchConfig(), {
    autoFan: false,
    quiet: false,
    powerful: false,
    xFan: false,
    health: false,
    light: false,
  });
  assert.equal(DEFAULT_DEVICE_CONFIG.xFanEnabled, true);
  assert.deepEqual(mergeFeatureSwitchConfig({ autoFan: true, xFan: true }, { xFan: false }), {
    autoFan: true,
    quiet: false,
    powerful: false,
    xFan: false,
    health: false,
    light: false,
  });
});

test('optional services have stable unique subtypes', () => {
  const subtypes = FEATURE_SWITCHES.map((name) => FEATURE_SWITCH_SERVICES[name].subtype);
  assert.equal(new Set(subtypes).size, FEATURE_SWITCHES.length);
  assert.equal(FEATURE_SWITCH_SERVICES.powerful.displayName, 'Turbo');
  assert.equal(FEATURE_SWITCH_SERVICES.light.displayName, 'GREE Light');
});

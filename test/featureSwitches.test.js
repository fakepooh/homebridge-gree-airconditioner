import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';

import {
  FEATURE_SWITCHES,
  FEATURE_SWITCH_DEFAULTS,
  FEATURE_SWITCH_SERVICES,
  autoFanFeatureSwitchCommand,
  featureSwitchCommand,
  mergeFeatureSwitchConfig,
  projectFeatureSwitch,
  quietFeatureSwitchCommand,
  sendQuietFeatureSwitchCommand,
  turboRotationSpeedProjection,
  turboFeatureSwitchCommand,
  xFanFeatureSwitchCommand,
  xFanModeCommand,
} from '../dist/featureSwitches.js';
import { DEFAULT_DEVICE_CONFIG } from '../dist/settings.js';

test('Auto Fan reflects only explicitly reported Auto speed and gives Turbo precedence', () => {
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 0, Tur: 0 }), true);
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 0, Tur: 1 }), false);
  for (const speed of [1, 2, 3, 4, 5]) {
    assert.equal(projectFeatureSwitch('autoFan', { WdSpd: speed, Tur: 0 }), false);
  }
  assert.equal(projectFeatureSwitch('autoFan', { Tur: 0 }), undefined);
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 0 }), undefined);
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 1 }), undefined);
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 1, Tur: undefined }), undefined);
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 6, Tur: 0 }), undefined);
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 0, Tur: 2 }), undefined);
  for (const turbo of [0, 1]) {
    assert.equal(projectFeatureSwitch('autoFan', { Tur: turbo }), undefined);
  }
  assert.equal(projectFeatureSwitch('autoFan', { WdSpd: 1, Tur: 1 }), false);
  assert.deepEqual(autoFanFeatureSwitchCommand({ WdSpd: 0, Tur: 0 }), {});
  assert.deepEqual(autoFanFeatureSwitchCommand({ WdSpd: 0 }), { WdSpd: 0, Tur: 0 });
  assert.deepEqual(autoFanFeatureSwitchCommand({ WdSpd: 1, Tur: 0 }), { WdSpd: 0, Tur: 0 });
  assert.deepEqual(autoFanFeatureSwitchCommand({ WdSpd: 0, Tur: 1 }), { WdSpd: 0, Tur: 0 });
  assert.deepEqual(autoFanFeatureSwitchCommand({ WdSpd: 0, Tur: 0, Quiet: 2 }), { WdSpd: 0, Quiet: 0, Tur: 0 });
  assert.deepEqual(featureSwitchCommand('autoFan', true), { WdSpd: 0, Tur: 0 });
  assert.deepEqual(featureSwitchCommand('autoFan', false), {});
});

test('Quiet is a momentary action, is mode-gated, and OFF requests no command', () => {
  assert.equal(projectFeatureSwitch('quiet', {}), false);
  assert.equal(projectFeatureSwitch('quiet', { Quiet: 2, WdSpd: 1 }), false);
  assert.deepEqual(featureSwitchCommand('quiet', true), { Quiet: 2 });
  assert.deepEqual(featureSwitchCommand('quiet', false), {});
  assert.deepEqual(quietFeatureSwitchCommand(true, 1, 1, 4), { Quiet: 2 });
  assert.deepEqual(quietFeatureSwitchCommand(true, 4, 1, 4), { Quiet: 2 });
  for (const mode of [0, 2, 3, undefined, 99]) {
    assert.deepEqual(quietFeatureSwitchCommand(true, mode, 1, 4), {});
  }
  assert.deepEqual(quietFeatureSwitchCommand(false, 1, 1, 4), {});
  assert.deepEqual(projectFeatureSwitch('quiet', { Quiet: 2 }), false);
});

test('repeated Quiet actions each send Quiet=2 despite an acknowledgement awaiting status reset', () => {
  const commands = [];
  const status = { Quiet: 0 };
  const sendCommand = (command) => {
    commands.push(command);
    status.Quiet = 2; // Simulate the acknowledgement before the next tap.
  };

  sendQuietFeatureSwitchCommand(true, 1, 1, 4, sendCommand);
  sendQuietFeatureSwitchCommand(true, 1, 1, 4, sendCommand);
  assert.deepEqual(commands, [{ Quiet: 2 }, { Quiet: 2 }]);
  // Any delayed reconciliation projects the momentary switch OFF from current status.
  assert.equal(projectFeatureSwitch('quiet', status), false);
});

test('Turbo status updates its slider projection without replacing the saved fan preference', () => {
  const savedRotationSpeed = 2; // Auto
  assert.deepEqual(featureSwitchCommand('powerful', true), { Tur: 1 });
  assert.deepEqual(featureSwitchCommand('powerful', false), { Tur: 0 });
  const turboOnProjection = turboRotationSpeedProjection(8, savedRotationSpeed);
  assert.equal(turboOnProjection.rotationSpeed, 8);
  assert.equal(turboOnProjection.preferredSpeed, savedRotationSpeed);

  const laterModeRestore = turboRotationSpeedProjection(8, turboOnProjection.preferredSpeed);
  assert.equal(laterModeRestore.preferredSpeed, 2);
  assert.notEqual(laterModeRestore.preferredSpeed, 8); // Do not restore the slider's Turbo display as High.
});

test('Turbo changes Tur only and projects reported state', () => {
  assert.equal(projectFeatureSwitch('powerful', { Tur: 1 }), true);
  assert.equal(projectFeatureSwitch('powerful', { Tur: 0 }), false);
  assert.equal(projectFeatureSwitch('powerful', {}), undefined);
  assert.deepEqual(featureSwitchCommand('powerful', true), { Tur: 1 });
  assert.deepEqual(featureSwitchCommand('powerful', false), { Tur: 0 });
});

test('Turbo ON is gated by the reported GREE mode while OFF always clears Tur', () => {
  assert.deepEqual(turboFeatureSwitchCommand(true, 1, 1, 4), { Tur: 1 });
  assert.deepEqual(turboFeatureSwitchCommand(true, 4, 1, 4), { Tur: 1 });
  for (const mode of [0, 2, 3, undefined, 99]) {
    assert.deepEqual(turboFeatureSwitchCommand(true, mode, 1, 4), {});
  }
  for (const mode of [0, 1, 2, 3, 4, undefined, 99]) {
    assert.deepEqual(turboFeatureSwitchCommand(false, mode, 1, 4), { Tur: 0 });
  }
});

test('X-Fan, Health, and Light project raw values and write only their own property', () => {
  for (const [name, property] of [['xFan', 'Blo'], ['health', 'Health'], ['light', 'Lig']]) {
    assert.equal(projectFeatureSwitch(name, { [property]: 1 }), true);
    assert.equal(projectFeatureSwitch(name, { [property]: 0 }), false);
    assert.equal(projectFeatureSwitch(name, {}), undefined);
  }
  assert.deepEqual(featureSwitchCommand('xFan', true), { Blo: 1 });
  assert.deepEqual(featureSwitchCommand('xFan', false), { Blo: 0 });
  assert.deepEqual(xFanFeatureSwitchCommand(true, 1, 1, 2), { Blo: 1 });
  assert.deepEqual(xFanFeatureSwitchCommand(true, 2, 1, 2), { Blo: 1 });
  for (const mode of [0, 3, 4, undefined, 99]) {
    assert.deepEqual(xFanFeatureSwitchCommand(true, mode, 1, 2), {});
  }
  for (const mode of [0, 1, 2, 3, 4, undefined, 99]) {
    assert.deepEqual(xFanFeatureSwitchCommand(false, mode, 1, 2), { Blo: 0 });
  }
  assert.deepEqual(xFanModeCommand(true, 1, 0, 1, 2), { Blo: 1 });
  assert.deepEqual(xFanModeCommand(true, 4, 1, 1, 2), { Blo: 0 });
  assert.deepEqual(xFanModeCommand(false, 1, 0, 1, 2), {});
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

test('npm test runs a fresh production build first', async () => {
  const { readFile } = await import('node:fs/promises');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts.pretest, 'npm run build');
  assert.equal(packageJson.scripts.test, 'node --test test/*.test.js');
});

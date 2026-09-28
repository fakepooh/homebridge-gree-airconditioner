export const FEATURE_SWITCHES = ['autoFan', 'quiet', 'powerful', 'xFan', 'health', 'light'] as const;

export type FeatureSwitchName = typeof FEATURE_SWITCHES[number];

export type FeatureSwitchConfig = Partial<Record<FeatureSwitchName, boolean>>;

export const FEATURE_SWITCH_DEFAULTS: Record<FeatureSwitchName, boolean> = {
  autoFan: false,
  quiet: false,
  powerful: false,
  xFan: false,
  health: false,
  light: false,
};

export const FEATURE_SWITCH_SERVICES: Record<FeatureSwitchName, { displayName: string; subtype: string }> = {
  autoFan: { displayName: 'Auto Fan', subtype: 'gree-feature-auto-fan' },
  quiet: { displayName: 'Quiet', subtype: 'gree-feature-quiet' },
  powerful: { displayName: 'Turbo', subtype: 'gree-feature-turbo' },
  xFan: { displayName: 'X-Fan', subtype: 'gree-feature-x-fan' },
  health: { displayName: 'Health', subtype: 'gree-feature-health' },
  light: { displayName: 'Light', subtype: 'gree-feature-light' },
};

export function mergeFeatureSwitchConfig(
  defaults?: FeatureSwitchConfig,
  overrides?: FeatureSwitchConfig,
): Record<FeatureSwitchName, boolean> {
  return Object.fromEntries(FEATURE_SWITCHES.map((name) => [name, overrides?.[name] ?? defaults?.[name] ?? false])) as
    Record<FeatureSwitchName, boolean>;
}

export function projectBooleanProperty(status: Record<string, unknown>, property: string): boolean | undefined {
  if (status[property] === 1) {
    return true;
  }
  if (status[property] === 0) {
    return false;
  }
  return undefined;
}

export function projectAutoFan(status: Record<string, unknown>): boolean | undefined {
  if (status.WdSpd !== 0 && status.WdSpd !== 1 && status.WdSpd !== 2 && status.WdSpd !== 3 &&
    status.WdSpd !== 4 && status.WdSpd !== 5) {
    return undefined;
  }
  if (status.Tur !== 0 && status.Tur !== 1) {
    return undefined;
  }
  return status.WdSpd === 0 && status.Tur === 0;
}

export function autoFanFeatureSwitchCommand(status: Record<string, unknown>): Record<string, number> {
  if (status.WdSpd === 0 && status.Tur === 0 && status.Quiet !== 2) {
    return {};
  }
  return status.Quiet === 2 ? { WdSpd: 0, Quiet: 0, Tur: 0 } : { WdSpd: 0, Tur: 0 };
}

export function quietFeatureSwitchCommand(
  enabled: boolean,
  reportedMode: unknown,
  coolMode: number,
  heatMode: number,
): Record<string, number> {
  return enabled && (reportedMode === coolMode || reportedMode === heatMode) ? { Quiet: 2 } : {};
}

export function sendQuietFeatureSwitchCommand(
  enabled: boolean,
  reportedMode: unknown,
  coolMode: number,
  heatMode: number,
  sendCommand: (command: Record<string, number>) => void,
): Record<string, number> {
  const command = quietFeatureSwitchCommand(enabled, reportedMode, coolMode, heatMode);
  if (Object.keys(command).length > 0) {
    sendCommand(command);
  }
  return command;
}

export function turboRotationSpeedProjection(maxSpeed: number, preferredSpeed: number): {
  rotationSpeed: number;
  preferredSpeed: number;
} {
  return { rotationSpeed: maxSpeed, preferredSpeed };
}

export function xFanModeCommand(
  enabled: boolean,
  mode: number,
  currentBlo: unknown,
  coolMode: number,
  dryMode: number,
): Record<string, number> {
  if (!enabled) {
    return {};
  }
  if ([coolMode, dryMode].includes(mode)) {
    return currentBlo !== 1 ? { Blo: 1 } : {};
  }
  return currentBlo !== 0 ? { Blo: 0 } : {};
}

export function projectFeatureSwitch(name: FeatureSwitchName, status: Record<string, unknown>): boolean | undefined {
  switch (name) {
  case 'autoFan':
    return projectAutoFan(status);
  case 'quiet':
    return false;
  case 'powerful':
    return projectBooleanProperty(status, 'Tur');
  case 'xFan':
    return projectBooleanProperty(status, 'Blo');
  case 'health':
    return projectBooleanProperty(status, 'Health');
  case 'light':
    return projectBooleanProperty(status, 'Lig');
  }
}

export function featureSwitchCommand(name: FeatureSwitchName, enabled: boolean): Record<string, number> {
  switch (name) {
  case 'autoFan':
    return enabled ? { WdSpd: 0, Tur: 0 } : {};
  case 'quiet':
    return enabled ? { Quiet: 2 } : {};
  case 'powerful':
    return { Tur: enabled ? 1 : 0 };
  case 'xFan':
    return { Blo: enabled ? 1 : 0 };
  case 'health':
    return { Health: enabled ? 1 : 0 };
  case 'light':
    return { Lig: enabled ? 1 : 0 };
  }
}

export function turboFeatureSwitchCommand(
  enabled: boolean,
  reportedMode: unknown,
  coolMode: number,
  heatMode: number,
): Record<string, number> {
  if (enabled && reportedMode !== coolMode && reportedMode !== heatMode) {
    return {};
  }
  return featureSwitchCommand('powerful', enabled);
}

export function xFanFeatureSwitchCommand(
  enabled: boolean,
  reportedMode: unknown,
  coolMode: number,
  dryMode: number,
): Record<string, number> {
  if (!enabled || reportedMode === coolMode || reportedMode === dryMode) {
    return featureSwitchCommand('xFan', enabled);
  }
  return {};
}

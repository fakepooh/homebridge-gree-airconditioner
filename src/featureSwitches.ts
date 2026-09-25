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
  light: { displayName: 'GREE Light', subtype: 'gree-feature-light' },
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
  return status.WdSpd === 0 && status.Tur !== 1;
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
    return enabled ? { WdSpd: 0, Quiet: 0, Tur: 0 } : {};
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

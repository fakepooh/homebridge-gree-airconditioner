import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const paths = [
  '../config.schema.json',
  '../schemas/config.schema.de.json',
  '../schemas/config.schema.es.json',
  '../schemas/config.schema.fr.json',
  '../schemas/config.schema.hu.json',
  '../schemas/config.schema.pl.json',
  '../schemas/config.schema.pt.json',
];
const expectedKeys = ['autoFan', 'quiet', 'powerful', 'xFan', 'health', 'light'];

test('English and localized schemas expose the same optional feature switches and form entries', async () => {
  const schemas = await Promise.all(paths.map(async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))));
  const expectedConfigKeys = Object.keys(schemas[0].schema.properties.devices.items.properties);
  for (const schema of schemas) {
    const deviceProperties = schema.schema.properties.devices.items.properties;
    assert.deepEqual(Object.keys(deviceProperties), expectedConfigKeys);
    const properties = deviceProperties.featureSwitches.properties;
    assert.deepEqual(Object.keys(properties), expectedKeys);
    for (const key of expectedKeys) {
      assert.deepEqual(properties[key], { type: 'boolean', default: false });
    }

    const devices = schema.layout.find((entry) => entry.type === 'array' && entry.key === 'devices');
    const featureSwitches = devices.items.flatMap((entry) => entry.items ?? [])
      .find((entry) => entry.type === 'fieldset' && entry.items?.some((field) => field.key === 'devices[].featureSwitches.autoFan'));
    assert.ok(featureSwitches, 'feature switches form fieldset exists');
    assert.deepEqual(featureSwitches.items.map((entry) => entry.key), expectedKeys.map((key) => `devices[].featureSwitches.${key}`));
  }
});

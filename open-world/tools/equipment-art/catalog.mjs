import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, '../..');
const defaultOutput = path.resolve(projectRoot, '../docs/05-art/equipment-icons-handdrawn-20261001/catalog');
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const slotIds = ['weapon', 'armor', 'helmet', 'boots', 'necklace', 'ring'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values, label) {
  assert(new Set(values).size === values.length, `${label} contains duplicates`);
}

function dimensions(values, label, count, statuses) {
  assert(Array.isArray(values) && values.length === count, `${label} requires exactly ${count} entries`);
  unique(values.map(entry => entry.id), label);
  for (const entry of values) {
    assert(entry && idPattern.test(entry.id), `Invalid ${label} id`);
    assert(typeof entry.label === 'string' && entry.label.trim().length > 0, `Missing ${label} label: ${entry.id}`);
    if (statuses) assert(statuses.includes(entry.status), `Invalid ${label} status: ${entry.id}`);
  }
}

export function validateSpec(spec) {
  assert(spec.schemaVersion === 1, 'Unsupported catalog spec schemaVersion');
  assert(spec.canvas?.width === 256 && spec.canvas?.height === 256 && spec.canvas?.transparent === true, 'Icons require a 256 x 256 transparent canvas');
  assert(typeof spec.title === 'string' && spec.title.length > 0, 'Missing catalog title');
  assert(typeof spec.styleReference === 'string' && spec.styleReference.length > 0, 'Missing approved style reference');
  dimensions(spec.slots, 'slots', 6);
  assert(slotIds.every((id, index) => spec.slots[index].id === id), 'Slot list/order must match the user-approved six slots');
  dimensions(spec.directions, 'directions', 6, ['proposed', 'confirmed']);
  dimensions(spec.series, 'series', 3, ['confirmed', 'optional']);
  assert(JSON.stringify(spec.tiers) === '[1,2,3]', 'Tier matrix must be T1/T2/T3');
  assert(typeof spec.sourceRoot === 'string' && /^assets\/[a-z0-9/-]+$/.test(spec.sourceRoot) && !spec.sourceRoot.includes('..'), 'Invalid project-relative source root');
  assert(typeof spec.publicRoot === 'string' && /^\/art\/[a-z0-9/-]+$/.test(spec.publicRoot) && !spec.publicRoot.includes('..'), 'Invalid public asset root');
  const profiles = Object.entries(spec.profiles ?? {});
  assert(profiles.length > 0, 'At least one profile is required');
  for (const [profile, series] of profiles) {
    assert(idPattern.test(profile) && Array.isArray(series) && series.length > 0, `Invalid profile: ${profile}`);
    unique(series, `profile ${profile}`);
    assert(series.every(id => spec.series.some(entry => entry.id === id)), `Unknown series in profile ${profile}`);
  }
  return spec;
}

export function createCatalog(inputSpec, profile, catalogDirectory = defaultOutput) {
  const spec = validateSpec(inputSpec);
  const seriesIds = spec.profiles[profile];
  assert(seriesIds, `Unknown profile: ${profile}`);
  const series = seriesIds.map(id => spec.series.find(entry => entry.id === id));
  const sets = [];
  const items = [];
  const sourcePrefix = path.relative(catalogDirectory, path.join(projectRoot, spec.sourceRoot)).split(path.sep).join('/');
  for (const family of series) for (const direction of spec.directions) for (const tier of spec.tiers) {
    const setId = `gear-${family.id}-${direction.id}-t${tier}`;
    const setLabel = `${family.label}·${direction.label}·T${tier}`;
    const set = {id: setId, label: setLabel, series: family.id, direction: direction.id, tier, iconIds: []};
    for (const slot of spec.slots) {
      const id = `${setId}-${slot.id}`;
      set.iconIds.push(id);
      items.push({
        id, setId, series: family.id, direction: direction.id, tier, slot: slot.id,
        name: `${setLabel}·${slot.label}`,
        source: `${sourcePrefix}/${id}.png`,
        sourcePath: `${spec.sourceRoot}/${id}.png`,
        publicPath: `${spec.publicRoot}/${id}.png`,
        productionStatus: 'pending',
      });
    }
    sets.push(set);
  }
  return {
    schemaVersion: 1,
    title: spec.title,
    profile,
    purpose: 'equipment-icon-production-plan',
    status: 'planned',
    styleReference: spec.styleReference,
    canvas: spec.canvas,
    scope: {series, directions: spec.directions, tiers: spec.tiers, slots: spec.slots},
    setCount: sets.length,
    iconCount: items.length,
    expectedCount: items.length,
    expectedSetCount: sets.length,
    sets,
    items,
  };
}

export function validateCatalog(catalog, spec, profile, catalogDirectory = defaultOutput) {
  const expected = createCatalog(spec, profile, catalogDirectory);
  assert(catalog?.purpose === expected.purpose && catalog.schemaVersion === 1 && catalog.profile === profile, 'Invalid catalog metadata');
  assert(Array.isArray(catalog.sets) && catalog.sets.length === expected.setCount && catalog.setCount === expected.setCount, 'Missing or unexpected sets');
  assert(Array.isArray(catalog.items) && catalog.items.length === expected.iconCount && catalog.iconCount === expected.iconCount && catalog.expectedCount === expected.iconCount && catalog.expectedSetCount === expected.setCount, 'Missing or unexpected icons');
  unique(catalog.sets.map(set => set.id), 'set IDs');
  for (const field of ['id', 'source', 'sourcePath', 'publicPath']) unique(catalog.items.map(icon => icon[field]), `icon ${field}`);
  const expectedIcons = new Map(expected.items.map(icon => [icon.id, icon]));
  for (const icon of catalog.items) {
    const expectedIcon = expectedIcons.get(icon.id);
    assert(expectedIcon, `Unexpected icon: ${icon.id}`);
    for (const field of ['setId', 'series', 'direction', 'tier', 'slot', 'source', 'sourcePath', 'publicPath']) {
      assert(icon[field] === expectedIcon[field], `Invalid ${field} for ${icon.id}`);
    }
  }
  const expectedSets = new Map(expected.sets.map(set => [set.id, set]));
  for (const set of catalog.sets) {
    const expectedSet = expectedSets.get(set.id);
    assert(expectedSet, `Unexpected set: ${set.id}`);
    for (const field of ['series', 'direction', 'tier']) assert(set[field] === expectedSet[field], `Invalid ${field} for ${set.id}`);
    assert(JSON.stringify(set.iconIds) === JSON.stringify(expectedSet.iconIds), `Missing, duplicated or misplaced slot in ${set.id}`);
  }
  return {profile, sets: catalog.setCount, icons: catalog.iconCount};
}

function csv(catalog) {
  const fields = ['id', 'setId', 'series', 'direction', 'tier', 'slot', 'name', 'source', 'sourcePath', 'publicPath', 'productionStatus'];
  const escape = value => `"${String(value).replaceAll('"', '""')}"`;
  return `${fields.join(',')}\n${catalog.items.map(icon => fields.map(field => escape(icon[field])).join(',')).join('\n')}\n`;
}

async function main(args) {
  const options = {spec: path.join(toolDirectory, 'catalog-spec.json'), out: defaultOutput, profile: null, check: false};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--check') options.check = true;
    else if (['--spec', '--out', '--profile'].includes(argument)) {
      assert(args[index + 1] && !args[index + 1].startsWith('--'), `Missing value for ${argument}`);
      options[argument.slice(2)] = args[++index];
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  const spec = validateSpec(JSON.parse(await fs.readFile(options.spec, 'utf8')));
  const profiles = options.profile ? [options.profile] : Object.keys(spec.profiles);
  const results = [];
  if (!options.check) await fs.mkdir(options.out, {recursive: true});
  for (const profile of profiles) {
    const catalog = createCatalog(spec, profile, path.resolve(options.out));
    const jsonContent = `${JSON.stringify(catalog, null, 2)}\n`;
    const csvContent = csv(catalog);
    const jsonPath = path.join(options.out, `${profile}.json`);
    const csvPath = path.join(options.out, `${profile}.csv`);
    if (options.check) {
      const existingJson = await fs.readFile(jsonPath, 'utf8');
      results.push(validateCatalog(JSON.parse(existingJson), spec, profile, path.resolve(options.out)));
      assert(existingJson === jsonContent, `Stale generated catalog: ${jsonPath}`);
      assert(await fs.readFile(csvPath, 'utf8') === csvContent, `Stale generated CSV: ${csvPath}`);
    } else {
      results.push(validateCatalog(catalog, spec, profile, path.resolve(options.out)));
      await fs.writeFile(jsonPath, jsonContent);
      await fs.writeFile(csvPath, csvContent);
    }
  }
  console.log(JSON.stringify({mode: options.check ? 'checked' : 'generated', output: path.resolve(options.out), profiles: results}, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}

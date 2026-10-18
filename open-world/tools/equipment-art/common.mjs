import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import sharp from 'sharp';

export const defaultSlots = ['weapon', 'armor', 'helmet', 'boots', 'necklace', 'ring'];
const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function argumentsFor(allowed) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const name = process.argv[i];
    if (!name.startsWith('--') || !allowed.includes(name.slice(2))) throw Error(`Unknown argument: ${name}`);
    if (name === '--help') { args.help = true; continue; }
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw Error(`Missing value for ${name}`);
    args[name.slice(2)] = value;
  }
  return args;
}

export async function loadManifest(path) {
  const manifestPath = resolve(path), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const items = manifest.items ?? manifest.icons ?? manifest.assets;
  if (!Array.isArray(items) || !items.length) throw Error('Manifest must contain a nonempty items array');
  for (const key of ['slots','directions','series','tiers']) manifest[key] ??= manifest.scope?.[key];
  manifest.expectedCount ??= manifest.iconCount;
  manifest.expectedSetCount ??= manifest.setCount;
  const slots = (manifest.slots ?? defaultSlots).map(value => typeof value === 'string' ? value : value.id);
  if (slots.length !== 6 || new Set(slots).size !== 6) throw Error('The equipment art manifest must define exactly six distinct slots');
  const ids = new Set(), sets = new Map(), dimensions = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object') throw Error('Invalid equipment item');
    item.name ??= item.label;
    for (const field of ['id', 'setId', 'direction', 'series', 'slot']) {
      if (typeof item[field] !== 'string' || !stableId.test(item[field])) throw Error(`Invalid ${field}: ${JSON.stringify(item[field])}`);
    }
    if (ids.has(item.id)) throw Error(`Duplicate equipment ID: ${item.id}`);
    ids.add(item.id);
    if (!item.name || typeof item.name !== 'string') throw Error(`Missing display name: ${item.id}`);
    if (!slots.includes(item.slot)) throw Error(`Unknown slot ${item.slot}: ${item.id}`);
    if (!/^(T)?[123]$/i.test(String(item.tier))) throw Error(`Invalid tier: ${item.id}`);
    item.tier = `T${String(item.tier).replace(/^T/i, '')}`;
    const dimension = [item.direction, item.series, item.tier].join('/');
    if (dimensions.has(dimension) && dimensions.get(dimension) !== item.setId) throw Error(`More than one set for ${dimension}`);
    dimensions.set(dimension, item.setId);
    const set = sets.get(item.setId) ?? {dimension, slots: new Set(), items: []};
    if (set.dimension !== dimension) throw Error(`Set ${item.setId} mixes directions, series or tiers`);
    if (set.slots.has(item.slot)) throw Error(`Duplicate ${item.slot} in ${item.setId}`);
    set.slots.add(item.slot); set.items.push(item); sets.set(item.setId, set);
  }
  for (const [id, set] of sets) {
    const missing = slots.filter(slot => !set.slots.has(slot));
    if (missing.length) throw Error(`Incomplete set ${id}: missing ${missing.join(', ')}`);
  }
  if (manifest.expectedCount != null && manifest.expectedCount !== items.length) throw Error(`Manifest count ${items.length} does not match expectedCount ${manifest.expectedCount}`);
  if (manifest.expectedSetCount != null && manifest.expectedSetCount !== sets.size) throw Error(`Set count ${sets.size} does not match expectedSetCount ${manifest.expectedSetCount}`);
  // Explicit dimensions prevent a complete-looking matrix from silently omitting a direction or tier.
  if (manifest.directions && manifest.series && manifest.tiers) {
    const values = list => list.map(value => typeof value === 'object' ? value.id : String(value));
    for (const direction of values(manifest.directions)) for (const series of values(manifest.series)) for (const tier of values(manifest.tiers)) {
      const key = `${direction}/${series}/T${tier.replace(/^T/i, '')}`;
      if (!dimensions.has(key)) throw Error(`Missing equipment set: ${key}`);
    }
  }
  return {manifest, manifestPath, base: dirname(manifestPath), items, sets, slots};
}

export function selectedItems(data, onlySet) {
  if (!onlySet) return data.items;
  const requested = onlySet.split(','), selected = new Set(requested);
  for (const id of selected) if (!data.sets.has(id)) throw Error(`Unknown set requested: ${id}`);
  return data.items.filter(item => selected.has(item.setId));
}

export async function inspectPng(bytes, id, {production = false} = {}) {
  const meta = await sharp(bytes, {limitInputPixels: 8192 * 8192}).metadata();
  if (meta.format !== 'png' || !meta.width || !meta.height || (meta.pages ?? 1) !== 1) throw Error(`Expected a single PNG: ${id}`);
  if (meta.width < 32 || meta.height < 32) throw Error(`Source is too small: ${id}`);
  if (production && (meta.width !== 256 || meta.height !== 256)) throw Error(`Production canvas must be 256×256: ${id}`);
  if (!meta.hasAlpha) throw Error(`Image has no alpha channel: ${id}`);
  const {data, info} = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let clear = 0, visible = 0, left = info.width, top = info.height, right = -1, bottom = -1, occupiedEdge = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const alpha = data[(y * info.width + x) * 4 + 3];
    if (alpha === 0) clear++;
    if (alpha > 2) {
      visible++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) occupiedEdge++;
    }
  }
  const pixels = info.width * info.height, transparentRatio = clear / pixels;
  if (transparentRatio < .02) throw Error(`Image lacks a transparent background: ${id}`);
  if (visible < pixels * .005) throw Error(`Image is blank or nearly blank: ${id}`);
  const bounds = {left, top, width:right-left+1, height:bottom-top+1};
  if (production && (left < 24 || top < 24 || right > 231 || bottom > 231)) throw Error(`Artwork exceeds the 208px safe area: ${id}`);
  return {size:[meta.width,meta.height], bounds, transparentRatio, visibleRatio:visible/pixels, touchesSourceEdge:occupiedEdge>0, pixelSha256:hash(data), sha256:hash(bytes)};
}

export function labels(manifest, key, defaults = {}) {
  return {...defaults, ...Object.fromEntries((manifest[key] ?? []).map(value => typeof value === 'string' ? [value,defaults[value]??value] : [value.id,value.name ?? value.label ?? value.id]))};
}

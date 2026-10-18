// Publish the accepted independent skin package without an editor or D: source dependency.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve, join, relative} from 'node:path';
import {createHash} from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const canonical = join(root, 'assets/mini-hero/navy');
const destination = join(root, 'apps/web/public/art/mini-hero/navy');
const checkOnly = process.argv.includes('--check');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const release = JSON.parse(await readFile(join(canonical, 'release.json'), 'utf8'));
const profileBytes = await readFile(join(canonical, 'profile.json'));
const profile = JSON.parse(profileBytes);
const source = resolve(root, release.source);
if (source === destination || relative(source, destination).startsWith('..') === false) throw Error('Source and publish directory must be separate');
const buffers = {};
for (const [name, expected] of Object.entries(release.files)) {
  if (!['Character.json', 'Character.atlas', 'Character.png', 'Character_2.png'].includes(name)) throw Error('Unexpected release file ' + name);
  const bytes = await readFile(join(source, name));
  if (bytes.length !== expected.bytes || hash(bytes) !== expected.sha256) throw Error('Accepted asset changed: ' + name);
  buffers[name] = bytes;
}
const skeleton = JSON.parse(buffers['Character.json']);
if (skeleton.skeleton.spine !== release.nativeVersion) throw Error('Native skeleton version mismatch');
if (profile.runtime.pma !== true || profile.runtime.json !== '/art/mini-hero/navy/Character.json' || profile.runtime.atlas !== '/art/mini-hero/navy/Character.atlas') throw Error('Unexpected published runtime profile');
const pagePma = buffers['Character.atlas'].toString('utf8').split(/\r?\n/).filter(line => line.startsWith('pma:'));
if (pagePma.length !== 2 || pagePma.some(line => line.trim() !== 'pma:true')) throw Error('Original atlas pages must remain PMA');
if (profile.nativeFacing !== 'left' || profile.fps !== 60 || !(profile.referenceHeight > 0) || profile.ground.length !== 2) throw Error('Invalid model presentation geometry');
const appearance = JSON.parse(await readFile(join(root, 'packages/content/appearance.json'), 'utf8'));
const bodySets = new Set(profile.acceptedBodySets);
if (bodySets.size !== 2 || !bodySets.has('100011') || !bodySets.has('100041')) throw Error('Only explicitly accepted starting body sets may use this skin');
const availableSkins = new Set(skeleton.skins.map(skin => skin.name));
const availableSlots = new Set(skeleton.slots.map(slot => slot.name));
for (const name of profile.skinNames) if (!availableSkins.has(name)) throw Error('Missing body skin: ' + name);
const expectedMappings = {100011: 'sword', 300601: 'sword', 400105: 'magic'};
if (Object.keys(profile.weapons).length !== Object.keys(expectedMappings).length) throw Error('Unexpected weapon mapping count');
for (const [setId, weapon] of Object.entries(profile.weapons)) {
  const bundle = appearance.bundles.find(bundle => bundle.id === setId);
  if (expectedMappings[setId] !== weapon.family || !bundle?.weaponFamilies.includes(weapon.family)) throw Error('Appearance family mismatch: ' + setId);
  for (const name of weapon.skinNames) if (!availableSkins.has(name)) throw Error('Missing weapon skin: ' + name);
  for (const action of ['idle', 'move', 'attack', 'skill', 'projectile', 'hurt', 'death']) {
    const record = weapon.actions[action];
    if (!record || !skeleton.animations[record.name]) throw Error('Missing action: ' + setId + '/' + action);
    if (record.impactTime !== undefined && (!Number.isFinite(record.impactTime) || record.impactTime < 0)) throw Error('Invalid visual impact time');
  }
  for (const [name, socket] of Object.entries(weapon.sockets)) {
    if (!availableSlots.has(socket.slot) || socket.pixel.length !== 2 || socket.imageSize.length !== 2) throw Error('Invalid socket: ' + setId + '/' + name);
    if (socket.pixel.some((value, i) => !Number.isFinite(value) || value < 0 || value >= socket.imageSize[i])) throw Error('Socket outside original source canvas');
    const skin = skeleton.skins.find(skin => skin.name === weapon.skinNames[0]);
    const attachment = Object.values(skin.attachments[socket.slot] ?? {})[0];
    if (!attachment || (attachment.type && attachment.type !== 'region') || attachment.width !== socket.imageSize[0] || attachment.height !== socket.imageSize[1]) throw Error('Socket source dimensions do not match native attachment');
  }
  if (!weapon.sockets.weapon || !weapon.sockets.muzzle) throw Error('Published weapons must define both weapon and muzzle sockets: ' + setId);
  if (weapon.family === 'sword' && (weapon.muzzlePolicy !== 'weapon-tip' || JSON.stringify(weapon.sockets.weapon) !== JSON.stringify(weapon.sockets.muzzle))) throw Error('Sword projectiles must use the explicitly accepted blade-tip release surface');
}
const manifestBytes = Buffer.from(JSON.stringify({
  schemaVersion: 1, id: profile.id, nativeVersion: release.nativeVersion,
  source: release.source, provenanceSource: release.provenanceSource, files: release.files,
  profileSha256: hash(profileBytes), bodySets: profile.acceptedBodySets,
  mappedWeaponSets: Object.keys(profile.weapons), physicsConstraints: skeleton.physics.length,
  animations: Object.keys(skeleton.animations).length,
}, null, 2) + '\n');
const output = {...buffers, 'profile.json': profileBytes, 'release-manifest.json': manifestBytes};
if (!checkOnly) await mkdir(destination, {recursive: true});
for (const [name, bytes] of Object.entries(output)) {
  const path = join(destination, name);
  if (checkOnly) {
    const published = await readFile(path);
    if (!published.equals(bytes)) throw Error('Published asset differs from accepted source: ' + name);
  } else if (buffers[name]) {
    await copyFile(join(source, name), path);
  } else {
    await writeFile(path, bytes);
  }
}
console.log(`${checkOnly ? 'Verified' : 'Published'} MiniFantasy navy skin: 4 exact source files, ${Object.keys(profile.weapons).length} existing weapon set mappings, original 4.2.43 geometry and PMA.`);

// Axe/hammer extension art for the native gear kits: the registered catalog plus each item's PNG, byte-exact.
const extSource = join(root, 'assets/mini-hero/extensions'), extDestination = join(root, 'apps/web/public/art/mini-hero/extensions');
const extCatalog = JSON.parse(await readFile(join(extSource, 'extensions.json'), 'utf8'));
if (!checkOnly) await mkdir(extDestination, {recursive: true});
for (const name of ['extensions.json', ...extCatalog.items.map(item => item.file)]) {
  const bytes = await readFile(join(extSource, name)), path = join(extDestination, name);
  if (checkOnly) {
    if (!(await readFile(path)).equals(bytes)) throw Error('Published extension differs from source: ' + name);
  } else await copyFile(join(extSource, name), path);
}
console.log(`${checkOnly ? 'Verified' : 'Published'} ${extCatalog.items.length} axe/hammer extension weapons.`);

// Offline native-runtime geometry evidence. Does not render screenshots or change animation data.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import * as spine from '@esotericsoftware/spine-webgl';

const root = resolve(import.meta.dirname, '..');
const canonical = join(root, 'assets/mini-hero/navy');
const profile = JSON.parse(await readFile(join(canonical, 'profile.json'), 'utf8'));
const jsonBytes = await readFile(join(canonical, 'runtime/Character.json'));
const atlasBytes = await readFile(join(canonical, 'runtime/Character.atlas'));
const atlas = new spine.TextureAtlas(atlasBytes.toString('utf8'));
const data = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(jsonBytes));
const checksum = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {
  source: 'assets/mini-hero/navy/runtime', sourceJsonSha256: checksum(jsonBytes),
  sourceAtlasSha256: checksum(atlasBytes), nativeVersion: data.version,
  fps: profile.fps, eventsDefined: Object.keys(JSON.parse(jsonBytes).events ?? {}).length,
  timingMeaning: 'Visual synchronization only. No source release event exists; gameplay windup/impact/reward data is unchanged.',
  screenshots: false, measurements: [],
};
for (const [setId, weapon] of Object.entries(profile.weapons)) {
  const measured = new Set();
  for (const [purpose, actionRecord] of Object.entries(weapon.actions)) {
    if (actionRecord.impactTime === undefined || measured.has(actionRecord.name)) continue;
    measured.add(actionRecord.name);
    const skeleton = new spine.Skeleton(data);
    const skin = new spine.Skin('measurement');
    for (const name of [...profile.skinNames, ...weapon.skinNames]) skin.addSkin(data.findSkin(name));
    skeleton.setSkin(skin);
    skeleton.setToSetupPose();
    const state = new spine.AnimationState(new spine.AnimationStateData(data));
    state.setAnimation(0, actionRecord.name, false);
    state.apply(skeleton);
    skeleton.updateWorldTransform(spine.Physics.update);
    const duration = data.findAnimation(actionRecord.name).duration;
    const frames = [];
    for (let frame = 0; frame <= Math.round(duration * profile.fps); frame++) {
      if (frame) {
        const delta = 1 / profile.fps;
        skeleton.update(delta); state.update(delta); state.apply(skeleton);
        skeleton.updateWorldTransform(spine.Physics.update);
      }
      const sockets = {};
      for (const [name, calibration] of Object.entries(weapon.sockets)) {
        const slot = skeleton.findSlot(calibration.slot);
        const attachment = slot.getAttachment();
        if (!(attachment instanceof spine.RegionAttachment)) throw Error('Calibration expects native RegionAttachment');
        const [width, height] = calibration.imageSize;
        const x = (calibration.pixel[0] / width - 0.5) * attachment.width * attachment.scaleX;
        const y = (0.5 - calibration.pixel[1] / height) * attachment.height * attachment.scaleY;
        const angle = attachment.rotation * Math.PI / 180;
        const point = slot.bone.localToWorld({
          x: x * Math.cos(angle) - y * Math.sin(angle) + attachment.x,
          y: x * Math.sin(angle) + y * Math.cos(angle) + attachment.y,
        });
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw Error('Non-finite calibrated socket');
        sockets[name] = {x: point.x, y: point.y};
      }
      frames.push({time: frame / profile.fps, sockets});
    }
    const atImpact = frames.reduce((previous, current) => Math.abs(current.time - actionRecord.impactTime) < Math.abs(previous.time - actionRecord.impactTime) ? current : previous);
    const firstStrike = frames.filter(frame => frame.time >= 0.2 && frame.time <= 0.6);
    const frontmost = firstStrike.reduce((previous, current) => current.sockets.weapon.x < previous.sockets.weapon.x ? current : previous);
    report.measurements.push({
      setId, family: weapon.family, weaponSkins: weapon.skinNames, purpose,
      action: actionRecord.name, duration, profileImpactTime: actionRecord.impactTime,
      atImpact, frontmostFirstStrikeSample: frontmost, sourceCalibration: weapon.sockets, frames,
    });
  }
}
const directory = join(root, 'docs/reviews/mini-hero-release');
await mkdir(directory, {recursive: true});
await writeFile(join(directory, 'impact-runtime.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Measured ${report.measurements.length} source animations with native 4.2 runtime at ${profile.fps} Hz; no source events or gameplay values changed.`);

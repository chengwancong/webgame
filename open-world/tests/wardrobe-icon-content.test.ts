import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../packages/content/equipment-catalog.json';
import icons from '../assets/mini-hero/icons-v2/manifest.json';
import thumbs from '../assets/mini-hero/thumbs/manifest.json';
import skeleton from '../assets/mini-hero/navy/runtime/Character.json';
import extensions from '../assets/mini-hero/extensions/extensions.json';
const skinNames=new Set(skeleton.skins.map(s=>s.name));
describe('appearance-matched wardrobe icons',()=>{
 it('covers exactly all weapon, armor and boots items, keeping IDs stable',()=>{
  const expected=catalog.items.filter(i=>['weapon','armor','boots'].includes(i.part));expect(icons.items).toHaveLength(162);expect(new Set(icons.items.map(i=>i.id)).size).toBe(162);expect(icons.items.map(i=>i.id).sort()).toEqual(expected.map(i=>i.id).sort());for(const item of icons.items)expect(item.iconId).toBe(expected.find(i=>i.id===item.id)!.iconId);
 });
 it('uses actual matching native roles, and real axe/hammer source images for extension gaps',()=>{
  const sources=new Map(extensions.items.map(i=>['EXT/'+i.id,i]));
  for(const icon of icons.items)for(const role of Object.values(icon.roles)){
   if(role.startsWith('EXT/')){const extension=sources.get(role);expect(extension).toBeTruthy();expect(icon.family==='axe'||icon.family==='hammer').toBe(true);expect(extension!.originalIconId).toBe(icon.iconId);expect(icon.sourceType).toBe('existing-extension-source');}
   else expect(skinNames.has(role),role).toBe(true);
  }
  expect(icons.items.filter(i=>i.sourceType==='native-render')).toHaveLength(144);expect(sources.size).toBe(18);
 });
 it('registers every face and hair choice with genuine native thumbnails',()=>{
  const ids=new Set(thumbs.items.map(i=>i.id));for(const name of skinNames){if(name.startsWith('HEAD/'))expect(ids.has('face/'+name.slice(5))).toBe(true);if(name.startsWith('HAIR/'))expect(ids.has('hair/'+name.slice(5))).toBe(true);}
 });
 it('keeps every exported icon byte-identical to its registered digest',()=>{
  for(const icon of icons.items){const bytes=readFileSync(new URL('../assets/mini-hero/icons-v2/'+icon.file,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex'),icon.id).toBe(icon.sha256);}
 });
});

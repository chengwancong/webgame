import {legacyProgressionGear} from './legacy-progression-gear.ts';
import {z} from 'zod';
import source from './appearance.json';
import assetCatalog from '../asset-manifest/wardrobe-catalog.json';
import assetManifest from '../asset-manifest/wardrobe.json';
import {appearanceSlotSchema,weaponFamilies} from '../contracts/appearance.ts';
import gearDefinitions from '../rules/gear-bases.json';
import {progressionGearTemplates} from './deep-progression.ts';
import {regions} from './index.ts';
import {collectionGearTemplates,collectionAppearanceMappings} from './equipment-runtime.ts';

const id=z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const unlock=z.discriminatedUnion('type',[
 z.object({type:z.literal('starter')}).strict(),
 z.object({type:z.literal('gear'),base:id}).strict(),
 z.object({type:z.literal('region'),region:id}).strict(),
 z.object({type:z.literal('boss'),boss:id}).strict(),
 z.object({type:z.literal('nodeFirstClear'),node:id}).strict(),
]);
export const appearanceConfigSchema=z.object({version:z.number().int().positive(),defaultSet:id,fallbackFamily:z.enum(weaponFamilies),defaultWeaponSets:z.record(z.enum(weaponFamilies),id),bundles:z.array(z.object({id,back:z.enum(['hair','gear','none']),name:z.string().min(1),slots:z.array(appearanceSlotSchema).min(1),weaponFamilies:z.array(z.enum(weaponFamilies)).min(1),unlock,unlockHint:z.string().min(1)}).strict()).min(1),equipment:z.record(id,z.object({family:z.enum(weaponFamilies).optional(),setId:id}).strict())}).strict().superRefine((value,ctx)=>{
 const sets=new Map(value.bundles.map(b=>[b.id,b]));
 const add=(message:string)=>ctx.addIssue({code:'custom',message});
 if(sets.size!==value.bundles.length)add('Duplicate appearance ID');
 const defaults=sets.get(value.defaultSet);
 if(!defaults||defaults.unlock.type!=='starter'||defaults.slots.length!==7)add('Default must be a complete starter set');
 // 默认套装的背部是兜底的“空背部”，不能是后发或背饰。
 if(defaults&&defaults.back!=='none')add('Default set must have an empty back part');
 const bases=new Set([...gearDefinitions,...progressionGearTemplates,...collectionGearTemplates].map(g=>g.base));
 const regionIds=new Set(regions.map(r=>r.id));
 for(const b of value.bundles){
  if(new Set(b.slots).size!==b.slots.length)add('Duplicate appearance slot: '+b.id);
  if(b.unlock.type==='gear'&&!bases.has(b.unlock.base))add('Unknown collection equipment: '+b.id);
  if(b.unlock.type==='region'&&!regionIds.has(b.unlock.region))add('Unknown unlock region: '+b.id);
  const requirement=b.unlock;
  if(requirement.type==='boss'&&!regions.some(r=>r.boss&&r.id===requirement.boss))add('Unknown unlock boss: '+b.id);
  if(requirement.type==='nodeFirstClear'&&!/^(wind|mist|forge|frost|rift|dragon)-gate$/.test(requirement.node))add('Unknown unlock node: '+b.id);
 }
 for(const [base,mapping] of Object.entries(value.equipment)){
  if(!bases.has(base))add('Unknown equipment appearance mapping: '+base);
  if(!sets.has(mapping.setId))add('Unknown appearance set: '+mapping.setId);
  const definition=[...gearDefinitions,...progressionGearTemplates.map(g=>({...g,slot:'weapon'})),...collectionGearTemplates].find(g=>g.base===base);
  if(definition?.slot==='weapon'&&!mapping.family)add('Weapon must declare animation family: '+base);
 }
 for(const family of weaponFamilies)if(!sets.get(value.defaultWeaponSets[family])?.weaponFamilies.includes(family))add('Missing compatible default weapon: '+family);
 for(const base of bases)if(!value.equipment[base])add('Missing equipment appearance: '+base);
});
const inheritedEquipment=Object.fromEntries(legacyProgressionGear.filter(g=>g.appearanceSource).map(g=>{const entry=(source.equipment as Record<string,unknown>)[g.appearanceSource!];if(!entry)throw Error('成长装备缺少同武器外观来源 '+g.base);return [g.base,entry];}));
export const appearanceContent=appearanceConfigSchema.parse({...source,equipment:{...source.equipment,...inheritedEquipment,...collectionAppearanceMappings}});
// Assets are independently versioned. CI/build checks this catalog against the
// generated manifest; importing this module never grants resource ownership.
export function validateAppearanceAssets(sets:{id:string;slots:readonly string[]}[]){
 const resources=new Map(sets.map(s=>[s.id,s]));
 for(const bundle of appearanceContent.bundles){
  const resource=resources.get(bundle.id);
  if(!resource)throw Error('Missing appearance asset '+bundle.id);
  for(const slot of bundle.slots)if(!resource.slots.includes(slot))throw Error('Missing '+slot+' asset in '+bundle.id);
 }
}

validateAppearanceAssets(assetCatalog.sets.filter(s=>s.shipped).map(s=>({id:s.setId,slots:Object.entries(assetCatalog.partSlots).filter(([,parts])=>parts.every(part=>Object.hasOwn(s.parts,part))).map(([slot])=>slot)})));
for(const bundle of appearanceContent.bundles){if(!assetManifest.shippedSets.includes(bundle.id))throw Error('Unshipped appearance '+bundle.id);const asset=assetCatalog.sets.find(s=>s.setId===bundle.id);if(!asset||bundle.weaponFamilies.some(f=>!asset.weaponFamilies.includes(f)))throw Error('Incompatible weapon appearance '+bundle.id);}

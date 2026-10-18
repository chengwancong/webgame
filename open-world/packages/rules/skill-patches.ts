import {skillSchema,type Skill} from '../contracts/index.ts';
import {skillPatchSchema,type SkillPatch} from '../contracts/skill-patches.ts';
import {skillCatalog} from '../content/index.ts';
import {skillTags} from '../content/skill-tags.ts';
function read(obj:any,path:string){return path.split('.').reduce((value,key)=>value?.[key],obj);}
function write(obj:any,path:string,value:unknown){const parts=path.split('.'),key=parts.pop()!;let parent=obj;for(const part of parts){parent[part]??={};if(typeof parent[part]!=='object'||parent[part]===null||Array.isArray(parent[part]))throw Error('Patch crosses non-object '+path);parent=parent[part];}parent[key]=value;}
const integral=new Set(['damage','projectiles','cooldown','cost','windup','duration','charges','mechanics.projectile.penetrations','mechanics.zone.hits','mechanics.zone.interval','mechanics.zone.firstDelay','mechanics.chain.count']);
/** Server-only operation: clones inputs, validates paths and the resulting skill. */
export function applySkillPatches(skill:Skill,patches:SkillPatch[],budgetScale=1,categoryOverride?:string,tagger:typeof skillTags=skillTags):Skill{
 if(!Number.isFinite(budgetScale)||budgetScale<0)throw Error('Invalid patch budget scale');
 const out=structuredClone(skill),touched=new Set<string>(),definition=skillCatalog.find(s=>s.id===skill.id);if(!definition)throw Error('Unknown skill '+skill.id);const category=categoryOverride??definition.category,derive=(s:Skill)=>tagger({...s,category}),mechanismTags=(s:Skill)=>{const tags=derive(s);return s.kind==='dash'&&!tags.includes('dash')?[...tags,'dash' as const]:tags;};
 for(const input of patches){const patch=skillPatchSchema.parse(input),tags=mechanismTags(out);if(patch.skills&&!patch.skills.includes(out.id)||patch.tags&&!patch.tags.some(tag=>tags.includes(tag as never)))continue;
  const beforeDamage=out.damage;
  for(const op of patch.ops){const old=read(out,op.path),fallback=op.path==='projectiles'?1:0;let value:unknown;
   if(op.op==='set')value=structuredClone(op.value);else if(op.op==='append'){if(old!==undefined&&!Array.isArray(old))throw Error('Append target is not an array');value=[...(old??[]),...(op.value as unknown[])].map(v=>structuredClone(v));}
   else {if(old!==undefined&&typeof old!=='number')throw Error('Numeric patch target is not numeric');value=op.op==='add'?(old??fallback)+(op.value as number):(old??fallback)*(op.value as number);}
   if(integral.has(op.path)&&typeof value==='number')value=Math.round(value);
   if(op.path==='mechanics.statuses'&&Array.isArray(value)&&budgetScale!==1){const added=op.op==='append'?(old??[]).length:0;value=value.map((status,index)=>index>=added&&status.total!==undefined?{...status,total:Math.round(status.total*budgetScale)}:status);}
   write(out,op.path,value);touched.add(op.path);
  }
  if(patch.scalePeriodicBudget){const periodic=out.mechanics?.statuses.filter(s=>s.total!==undefined&&['burn','poison','bleed'].includes(s.kind))??[];if(beforeDamage===0&&periodic.some(s=>s.total!>0))throw Error('Cannot scale a periodic budget from zero damage');const factor=beforeDamage===0?1:out.damage/beforeDamage;for(const status of periodic)if(status.kind!=='poison'||status.scope!=='hit')status.total=Math.round(status.total!*factor);}
 }
 out.tags=derive(out);
 // Hit poison belongs to the skill's total budget even after transformations.
 // Zone poison remains an independent additional budget under the RS ruling.
 if((touched.has('damage')||touched.has('mechanics.statuses'))&&out.mechanics)for(const status of out.mechanics.statuses)if(status.kind==='poison'&&status.scope==='hit'&&status.total!==undefined){if(!Number.isInteger(status.total)||status.total<0)throw Error('Invalid hit poison budget');status.total=Math.floor(out.damage/2);}
 if(touched.has('radius')&&out.mechanics?.projectile?.explosionRadius)out.mechanics.projectile.explosionRadius=out.radius;
 if(out.resolution&&touched.has('cooldown'))out.resolution={...out.resolution,baseCooldown:out.cooldown,finalCooldown:out.cooldown};
 const parsed=skillSchema.parse(out);
 // A whitelist entry cannot disappear through a stripping schema. New fields
 // become usable only after contracts and actual executors support them.
 for(const path of touched)if(read(out,path)!==undefined&&read(parsed,path)===undefined)throw Error('Unsupported skill mechanism '+path);
 return parsed;
}

/** D10/D11/D12 first release, applied through the existing JSON/CAS spine. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {effectRuleSchema,type EffectRule} from '../../packages/contracts/effects.ts';
import {hexRuneCatalogSchema,type HexRune} from '../../packages/content/hex-runes.ts';
import {describeAspectRule} from '../../packages/content/aspect-description.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
const file='packages/content/hex-runes.json',catalog=JSON.parse(await readFile(file,'utf8')) as HexRune[];
const designFiles=['d05-tuning-and-rulings.md','d06-mayhem-inspired-mechanisms.md','d08-hex-copy.md','d10-rules-rulings.md','d11-first-playstyles-and-mist-route.md','d12-b07-rulings-and-quests.md'];
const hashes=Object.fromEntries(await Promise.all(designFiles.map(async f=>[f,createHash('sha256').update(await readFile('docs/hex-gear-20261019/'+f)).digest('hex')])));
const basis='Claude D05/D06 exact C/M parameters; D10 lifecycle and D11 metadata/pair. '+JSON.stringify(hashes);
function effect(base:string,name:string,quality:string,extra:object):EffectRule{
 const r=effectRuleSchema.parse({id:base+'-'+quality,source:base,hexMechanism:base,name,description:name,trigger:'hit',chance:1,icd:0,vfxKey:'hex/'+base.slice(4),...extra});
 r.description=describeAspectRule(r);return r;
}
const additions:HexRune[]=[
 {id:'hex-footfall-heal',name:'行路回春',description:'走得越远，伤口愈合得越快。',category:'mobility',icon:'hex-ph-syn',exclusiveGroup:'footfall-heal',playstyle:'穿行续战',flavor:'送信人的老话：脚不停，气就不断。',tiers:{} as HexRune['tiers']},
 {id:'hex-control-to-shield',name:'控场成盾',description:'敌人被你控住的瞬间，你获得护盾。',category:'defense',icon:'hex-ph-syn',exclusiveGroup:'control-to-shield',playstyle:'穿行续战',prereq:'control-source',flavor:'拦路的人站稳了，自己也就稳了。',tiers:{} as HexRune['tiers']},
 {id:'hex-cast-hit-relay',name:'技攻接力',description:'技能与普攻交替打出，一次比一次重。',category:'synergy',icon:'hex-ph-syn',exclusiveGroup:'cast-hit-relay',playstyle:'节奏接力',flavor:'一封一封接着送，别在驿站停。',tiers:{} as HexRune['tiers']},
 {id:'hex-void-rift',name:'虚空裂隙',description:'每隔一会儿，脚下裂开一道吞噬一切的缝。',category:'attack',icon:'hex-ph-atk',exclusiveGroup:'void-rift',playstyle:'贴身绞杀',flavor:'邮路上有一道缝，寄进去的信再没回来过。',tiers:{} as HexRune['tiers']},
 {id:'hex-mark-relay',name:'印记接力',description:'技能种下印记，普攻把它收走。',category:'synergy',icon:'hex-ph-syn',exclusiveGroup:'mark-relay',playstyle:'先铺后炸',flavor:'先盖章，后收件，一环扣一环。',tiers:{} as HexRune['tiers']},
 {id:'hex-bee-volley',name:'蜂群齐射',description:'蓄满一轮，下一次技能命中就放出蜂群。',category:'attack',icon:'hex-ph-syn',exclusiveGroup:'bee-volley',playstyle:'节奏接力',flavor:'蜂箱里的信号，等蓄满再放。',tiers:{} as HexRune['tiers']},
];
for(const [i,q] of (['common','magic'] as const).entries()){
 const requiredLevel=[10,15][i],make=(r:HexRune,suffix:string,extra:object)=>effect(r.id,r.name,q+suffix,{tier:i+1,...extra});
 const [move,control,relay,rift,mark,bee]=additions;
 move.tiers[q]={requiredLevel,rules:[make(move,'',{trigger:'moved',every:[10,9][i],action:{type:'heal',ratio:.01,ref:'maxHp'},scale:['action.ratio']})]};
 control.tiers[q]={requiredLevel,rules:[make(control,'',{trigger:'status_apply',icd:60,filter:{statusKinds:['freeze','stun','fear','petrify','root']},action:{type:'shield',ratio:[.05,.06][i],ref:'maxHp',duration:240},scale:['action.ratio']})]};
 relay.tiers[q]={requiredLevel,rules:[
  make(relay,'-cast',{trigger:'cast',filter:{attackSources:['cast']},action:{type:'buff',duration:1,untilCombatEnd:true,maxStacks:1,mods:{damageMult:[.3,.4][i]},consume:'nextBasicHit'},scale:['action.mods.damageMult']}),
  make(relay,'-basic',{filter:{attackSources:['basic']},action:{type:'buff',duration:1,untilCombatEnd:true,maxStacks:1,mods:{damageMult:[.2,.25][i]},consume:'nextSkillCast'},scale:['action.mods.damageMult']}),
 ]};
 rift.tiers[q]={requiredLevel,rules:[make(rift,'',{trigger:'interval',every:300,action:{type:'field',at:'self',radius:3,duration:90,interval:30,ratio:[.25,.30][i],damageType:'shadow'},scale:['action.ratio']})]};
 mark.tiers[q]={requiredLevel,rules:[
  make(mark,'-apply',{filter:{attackSources:['cast']},action:{type:'mark',key:'relay',duration:150}}),
  make(mark,'-consume',{filter:{attackSources:['basic'],mark:'relay'},action:{type:'unmark',key:'relay'},after:[{type:'nova',at:'target',radius:0,maxTargets:1,ratio:[.4,.5][i],ref:'attack',damageType:'shadow'},{type:'cooldown',mode:'random',ticks:15}],scale:['after.0.ratio']}),
 ]};
 bee.tiers[q]={requiredLevel,rules:[make(bee,'',{trigger:'interval',every:240,action:{type:'buff',duration:1,untilCombatEnd:true,maxStacks:1,mods:{},consume:'nextSkillHit'},consumeEffects:[{type:'homing',count:[3,4][i],ratio:.2,ref:'attack',damageType:'poison',status:{kind:'slow',duration:45,strength:.2,scope:'hit',cleanse:true}}],scale:['consumeEffects.0.ratio']})]};
}
const changes:SpineChange[]=[];
for(const id of ['hex-aftershock','hex-detonation-sigil']){
 const index=catalog.findIndex(r=>r.id===id);if(index<0)throw Error('Missing existing '+id);
 const before=catalog[index],after=structuredClone(before);
 Object.assign(after,id==='hex-aftershock'?{playstyle:'贴身绞杀',flavor:'驿道石板被马蹄敲了一整年，终于松了。'}:{playstyle:'先铺后炸',prereq:'dot-source',flavor:'火漆封口，一捏就烧。'});
 for(const t of Object.values(after.tiers))for(const r of t.rules){
  r.hexMechanism=id;
  if(id==='hex-aftershock'&&r.trigger==='nth')r.countScope='target';
  if(r.action.type==='nova'||r.action.type==='detonate')r.scale=['action.ratio'];
  r.description=describeAspectRule(r);
 }
 if(JSON.stringify(before)!==JSON.stringify(after))changes.push({file,path:[index],before,after,basis});
}
const newEntries=additions.filter(r=>{
 const old=catalog.find(x=>x.id===r.id);
 if(old&&JSON.stringify(old)!==JSON.stringify(r))throw Error('Existing entry changed: '+r.id);
 return !old;
});
hexRuneCatalogSchema.parse([...catalog.filter(r=>!additions.some(a=>a.id===r.id)),...additions]);
const schemas={[file]:hexRuneCatalogSchema},apply=process.argv.includes('--apply');
if(changes.length)console.log(await applySpinePlan('.',changes,schemas,{apply,output:'docs/reviews/numeric-spine-20261013/HEX-B07-D12-20261020/existing'}));
if(newEntries.length)console.log(await applySpinePlan('.',newEntries.map((after,i)=>({file,path:[catalog.length+i],before:null,after,basis,op:'append' as const})),schemas,{apply,output:'docs/reviews/numeric-spine-20261013/HEX-B07-D12-20261020/append'}));
console.log(JSON.stringify({apply,newMechanisms:newEntries.map(r=>r.id),firstReleaseTiers:16,remaining:[],designHashes:hashes}));

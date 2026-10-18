import {readFile,writeFile,mkdir,copyFile,cp,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {monsterSkills,chapterBossSkills} from '../../../../packages/content/chapter-combat.ts';
const root=resolve(import.meta.dirname,'../../../..'),local=resolve(root,'assets/starsea/vfx'),pub=resolve(root,'apps/web/public/art/starsea/vfx');
const hash=b=>createHash('sha256').update(b).digest('hex'),rel=p=>relative(root,p).replaceAll('\\','/'),read=async f=>JSON.parse(await readFile(resolve(root,f),'utf8'));
const requirements=await read('docs/starsea/requirements.json'),sources=await read('assets/starsea/vfx/source/clips.json'),tokens=await read('packages/ui-tokens/tokens.json');
const resolveToken=v=>String(v).replace(/\{([^}]+)\}/g,(_,path)=>resolveToken(path.split('.').reduce((value,key)=>value[key],tokens))),warningTokens=Object.fromEntries(Object.entries(tokens.Color.Combat).map(([key,value])=>[key,resolveToken(value)]));
await mkdir(pub,{recursive:true});
for(const file of await readdir(resolve(local,'source/player')))await copyFile(resolve(local,'source/player',file),resolve(pub,file));
await cp(resolve(local,'runtime/clips'),resolve(pub,'clips'),{recursive:true});
await cp(resolve(local,'source/clips.json'),resolve(pub,'clips.json'));
await mkdir(resolve(pub,'vendor'),{recursive:true});await copyFile(resolve(root,'node_modules/@esotericsoftware/spine-webgl/dist/iife/spine-webgl.js'),resolve(pub,'vendor/spine42.js'));
const ruleSource=await readFile(resolve(root,'packages/content/chapter-combat.ts')),simSource=await readFile(resolve(root,'packages/simulation/index.ts'));
const aiSource=await readFile(resolve(root,'packages/content/index.ts'),'utf8'),aiValue=k=>{const m=aiSource.match(new RegExp(k+':([.0-9]+)'));if(!m)throw Error('Actual AI rule absent '+k);return Number(m[1]);};
const colour={warm:'#ffdfa1',blue:'#a8deeb',ice:'#d7eff6',void:'#b8a1d4',fire:'#ffd19c',gold:'#ead6a5',green:'#b6d8b7',steam:'#91a8b4'};
const config={
 'ss-fx-melee':{release:'slash',impact:'warm-burst',tone:'warm',size:72},
 'ss-fx-shot':{release:'warm-burst',projectile:'blade-flight',impact:'warm-burst',tone:'blue',size:42},
 'ss-fx-charge':{release:'steam',active:'steam',impact:'warm-burst',tone:'warm',size:42},
 'ss-fx-void-bolt':{startup:'void-charge',release:'void-charge',projectile:'void-flight',impact:'void-impact',tone:'void',size:50},
 'ss-fx-summon':{startup:'summon',release:'summon',active:'summon',impact:'warm-burst',tone:'green',size:100},
 'ss-fx-flame':{startup:'warm-burst',release:'flame-release',active:'burning',impact:'flame-burst',tone:'fire',size:86},
 'ss-fx-stomp':{release:'ice-wave',active:'ice-wave',impact:'ice-burst',tone:'ice',size:80},
 'ss-fx-frost-bite':{release:'claw',impact:'ice-burst',status:'ice-wave',tone:'ice',size:44},
 'ss-fx-ice-arrow':{startup:'blade-charge',release:'warm-burst',projectile:'blade-flight',impact:'ice-burst',tone:'ice',size:50},
 'ss-fx-backstab':{release:'slash',impact:'warm-burst',tone:'void',size:60},
 'ss-fx-shield-bash':{release:'warm-burst',impact:'warm-burst',status:'summon',tone:'warm',size:65},
 'ss-fx-blessing':{startup:'summon',release:'summon',active:'summon',impact:'warm-burst',tone:'gold',size:100},
 'ss-fx-b01-lance':{startup:'blade-charge',release:'warm-burst',projectile:'blade-flight',impact:'ice-burst',tone:'blue',size:76},
 'ss-fx-b01-stomp':{release:'ice-wave',active:'ice-wave',impact:'ice-burst',tone:'ice',size:112},
 'ss-fx-b01-charge':{release:'steam',active:'steam',impact:'warm-burst',tone:'warm',size:66},
 'ss-fx-b02-bolt':{startup:'void-charge',release:'void-charge',projectile:'void-flight',impact:'void-burst',tone:'void',size:65,clasp:'ss-boss-fog-quartermaster'},
 'ss-fx-b02-zone':{startup:'void-charge',release:'void-burst',active:'void-zone',impact:'void-impact',tone:'void',size:120},
 'ss-fx-b02-summon':{startup:'summon',release:'summon',active:'summon',impact:'warm-burst',tone:'gold',size:124},
 'ss-fx-b03-beam':{startup:'warm-burst',release:'warm-burst',active:'beam',impact:'flame-burst',tone:'gold',size:145},
 'ss-fx-b03-flame':{startup:'warm-burst',release:'flame-release',active:'burning',impact:'flame-burst',tone:'fire',size:102},
 'ss-fx-b03-stomp':{release:'ice-wave',active:'ice-wave',impact:'ice-burst',tone:'ice',size:125},
 'ss-fx-b04-lance':{startup:'blade-charge',release:'warm-burst',projectile:'ice-lance',impact:'ice-burst',tone:'ice',size:88},
 'ss-fx-b04-blizzard':{startup:'ice-wave',release:'ice-ground',active:'ice-ground',impact:'ice-burst',tone:'ice',size:115,rain:true},
 'ss-fx-b04-burst':{startup:'ice-wave',release:'ice-burst',active:'ice-wave',impact:'ice-burst',tone:'ice',size:150},
 'ss-fx-b05-bolt':{startup:'void-charge',release:'void-charge',projectile:'void-flight',impact:'void-burst',tone:'void',size:80,clasp:'ss-boss-rift-marshal'},
 'ss-fx-b05-zone':{startup:'void-charge',release:'void-burst',active:'void-cloud',impact:'void-impact',tone:'void',size:140},
 'ss-fx-b05-ritual':{startup:'summon',release:'summon',active:'summon',impact:'void-burst',tone:'gold',size:135,device:'ss-boss-rift-marshal'},
 'ss-fx-b06-beam':{startup:'void-charge',release:'warm-burst',active:'beam',impact:'void-burst',tone:'gold',size:160},
 'ss-fx-b06-rain':{startup:'warm-burst',release:'flame-burst',active:'fire-rain',impact:'flame-burst',tone:'fire',size:110,rain:true},
 'ss-fx-b06-mark':{startup:'summon',release:'void-charge',active:'summon',impact:'void-burst',tone:'gold',size:115},
};
const filespec=async f=>{const b=await readFile(resolve(root,f)),m=f.endsWith('.png')?await sharp(b).metadata():undefined;return {path:f,sha256:hash(b),bytes:b.length,...(m?{width:m.width,height:m.height,alpha:m.hasAlpha}: {})};};
const parts={};for(const id of ['ss-boss-fog-quartermaster','ss-boss-rift-marshal']){
 const source='apps/web/public/art/starsea/bosses/'+id+'/parts.png',b=await readFile(resolve(root,source)),atlas=await readFile(resolve(root,'apps/web/public/art/starsea/bosses/'+id+'/Character.atlas'),'utf8');
 const match=atlas.match(new RegExp('starsea/'+id+'/core\\r?\\nbounds:(\\d+),(\\d+),(\\d+),(\\d+)'));
 if(!match)throw Error('Missing actual core '+id);const [left,top,width,height]=match.slice(1).map(Number),crop=await sharp(b).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // PMA->straight encoding is technical conversion of an existing registered part.
 for(let n=0;n<crop.data.length;n+=4){const a=crop.data[n+3]/255;if(a>0)for(let c=0;c<3;c++)crop.data[n+c]=Math.min(255,Math.round(crop.data[n+c]/a));}
 const out=resolve(pub,'parts',id+'-core.png');await mkdir(resolve(out,'..'),{recursive:true});await sharp(crop.data,{raw:crop.info}).png().toFile(out);
 const retained=resolve(local,'runtime/parts',id+'-core.png');await mkdir(resolve(retained,'..'),{recursive:true});await copyFile(out,retained);
 parts[id]={kind:'static-fragment',image:'/art/starsea/vfx/parts/'+id+'-core.png',source:{path:source,sha256:hash(b),region:'starsea/'+id+'/core',crop:[left,top,width,height],adoption:'Existing imagegen component only; crop/PMA encoding, no repaint; projectile movement is executor-owned.'},files:[await filespec(rel(out))]};
}
const generated={
 'ss-boss-fog-quartermaster':'C:/Users/ccc/.codex/generated_images/01a1027c-72ff-7441-bb1d-56b5a27ad29a/exec-e0f84082-d4a3-405b-83f7-0727a9c8fe11.png',
 'ss-boss-rift-marshal':'C:/Users/ccc/.codex/generated_images/01a1027c-72ff-7441-bb1d-56b5a27ad29a/exec-c658b94b-2806-4c0e-b7d5-f362023fca46.png',
};
for(const[id,rawPath]of Object.entries(generated)){
 const retained=resolve(local,'source/projectile-parts',id+'-violet-imagegen.png'),out=resolve(pub,'parts',id+'-violet.png');let raw;try{raw=await readFile(retained);}catch{raw=await readFile(rawPath);}await mkdir(resolve(retained,'..'),{recursive:true});await writeFile(retained,raw);await sharp(raw).trim({threshold:1}).resize({width:256,height:256,fit:'inside'}).png().toFile(out);
 const spec={kind:'static-fragment',image:'/art/starsea/vfx/parts/'+id+'-violet.png',source:{mode:'adaptation',tool:'built-in image_gen',path:rel(retained),sha256:hash(raw),input:parts[id].source,adjustments:['Central blue crystal changed to opaque amethyst; copper/gray-purple casing and actual transparent background retained.','Transparent trim/resample only after imagegen; static part motion remains independent executor position.'],prompt:'Edit target existing mechanical core. Change only cyan inner crystal to opaque gray-purple amethyst with painted facets. Keep copper casing, proportions, viewing angle, soft outlines and hand-painted shading. True transparency; no exterior glow/trail/shadow/text.'},files:[await filespec(rel(retained)),await filespec(rel(out))]};
 parts[id+'-violet']=spec;await mkdir(resolve(local,'runtime/parts'),{recursive:true});await copyFile(out,resolve(local,'runtime/parts',id+'-violet.png'));
}
const bladePath='G:/webgame/abyss-walker-migration/Q版日式手游SPINE特效300套/157-eff37feidaofx/0/j40004.png',bladeSource=resolve(local,'source/projectile-parts/blade-core.png'),bladeOut=resolve(pub,'parts/blade-core.png');let bladeRaw;try{bladeRaw=await readFile(bladeSource);}catch{bladeRaw=await readFile(bladePath);}await writeFile(bladeSource,bladeRaw);await sharp(bladeRaw).trim({threshold:1}).png().toFile(bladeOut);
parts['blade-core']={kind:'static-fragment',image:'/art/starsea/vfx/parts/blade-core.png',source:{mode:'reuse',path:bladePath,sha256:hash(bladeRaw),nativeVersion:'2.1.27',adoption:'Solid metal blade region j40004 from authorized library; static entity body complements original animated trail, not a fabricated Spine animation.'},files:[await filespec(rel(bladeSource)),await filespec(rel(bladeOut))]};
const aiReferences={
 'AI/melee':{windup:0,delay:0,duration:1,namespace:'simulation.enemyStep.basic-melee',note:'Immediate resolved hit; no fabricated telegraph window.'},
 'AI/ranged':{windup:0,delay:0,duration:40,namespace:'simulation.enemyStep.basic-ranged',note:'Immediate release; projectile life 40 ticks and .5 cells/tick; instance trajectory owns movement.'},
 'AI/charger':{windup:0,delay:25,duration:1,radius:1.5,namespace:'simulation.enemyStep.basic-area.charger',note:'Actual default charger telegraph lasts delay 25; dash displacement is immediate executor snapshot, not an invented windup.'},
 'AI/summoner':{windup:0,delay:0,duration:1,namespace:'simulation.enemyStep.summoner',note:'No formal cast windup; visual material accompanies actual summon event only.'},
};
function reference(r){if(aiReferences[r.rule]){const v={...aiReferences[r.rule]};if(r.id==='ss-fx-b01-charge')Object.assign(v,{radius:3.5,delay:35,namespace:'simulation.enemyStep.basic-area.boss-charger'});return v;}
 const boss=/^ss-fx-b\d\d-/.test(r.id)&&!['ss-fx-b03-flame','ss-fx-b01-stomp','ss-fx-b03-stomp'].includes(r.id);
 const def=boss?Object.values(chapterBossSkills).flatMap(b=>b.skills).find(s=>s.id===r.rule):monsterSkills[r.rule]??Object.values(chapterBossSkills).flatMap(b=>b.skills).find(s=>s.id===r.rule);
 if(!def)throw Error('Unknown actual reference '+r.id);
 if(r.windupTicks!==null&&r.windupTicks!==def.windup)throw Error('Frozen demand/timing mismatch '+r.id);
 return {windup:def.windup,delay:def.delay??0,duration:def.buff?.duration??def.duration??1,radius:def.radius,namespace:(boss?'chapterBossSkills':'monsterSkills')+'.'+r.rule,interruptible:def.interruptible??false,statuses:def.statuses,buff:def.buff,...(r.kind==='beam'?{halfWidth:chapterBossSkills.ancient_dragon_king.halfWidth,reach:chapterBossSkills.ancient_dragon_king.reach}:{}),note:r.kind==='zone'&&def.duration===1?'One logical tick; cosmetic burst may linger separately. New actor hit path remains to verify.':'Reference only; live resolved instance parameters replace fixture.'};}
const stageNames=['startup','release','projectile','active','impact','end','interrupt','status'];
const assets=[];
for(const r of requirements.vfx){
 const c=config[r.id];if(!c)throw Error('Missing effect '+r.id);const ref=reference(r),actors=[...requirements.monsters,...requirements.bosses].filter(a=>a.skills.includes(r.id)).map(a=>a.id),clips={};if(r.kind==='projectile')ref.projectile={speed:aiValue('projectileSpeed'),collisionRadius:aiValue('projectileHitRadius'),lifetimeTicks:aiValue('projectileTicks'),source:{path:'packages/content/index.ts',sha256:hash(Buffer.from(aiSource)),namespace:'aiRules'}};
 for(const stage of stageNames){
  let source=c[stage];if(stage==='startup')source??='warm-burst';if(stage==='end')source=c.active??c.impact??'warm-burst';if(stage==='interrupt')source='interrupt';
  if(!source){clips[stage]={kind:'none',reason:stage==='projectile'?'No projectile emitted by this rule.':stage==='status'?'No referenced persistent status.':'Only actual matching effect event may activate this stage.'};continue;}
  if(!sources[source])throw Error('Source export missing '+source);
  const s=sources[source],mount=stage==='impact'||stage==='status'?'hit':stage==='active'&&['zone','trap','summon','buff','beam'].includes(r.kind)?'ground':stage==='projectile'?'projectile':stage==='end'?'last-stage':r.mount;
  const size=stage==='startup'?22:stage==='impact'?Math.min(75,c.size):stage==='interrupt'?45:c.size;
  clips[stage]={kind:'atlas',sourceClip:source,image:s.image,atlas:s.atlas,frames:s.frames,fps:s.fps,sourceDuration:s.duration,anchor:s.anchor,canvas:s.canvas,nativeFacing:s.nativeFacing,mount,layer:mount==='ground'?'ground':'front',size,tint:colour[c.tone],blend:stage==='projectile'||source==='steam'?'source-over':'lighter',loop:stage==='startup'||stage==='projectile'||stage==='active'||stage==='status',retime:stage==='release'?{durationTicks:8,reason:'Effect-only release adapted to actual release event; actor source release separately maps frozen windup.'}:stage==='end'?{sourceWindow:[.68,1],durationTicks:12,reason:'Original decay tail only; cosmetic lifetime independent of damage.'}:null,...(stage==='active'&&r.kind==='zone'&&ref.duration>1?{distribution:'deterministic-inside-rule-shape',density:c.rain?8:12}:{}),source:{nativeLayer:s.source.original.id,version:s.source.original.nativeVersion,sha256:s.source.original.sha256,mode:s.sourceMode,originalPath:s.source.original.originalPath,adoptedSlots:'See '+rel(resolve(local,'evidence',source+'-native.json')),adjustments:[...s.source.slotAdjustments,...(s.source.removedSlots.length?['Omit registered decorative/text slots: '+s.source.removedSlots.join(',')]:[]),'Runtime scale/tint/mirror only; transparent source frames remain registered on one canvas.']}};
 }
 if(c.clasp)clips.projectile.components=[{part:c.clasp,...parts[c.clasp+'-violet'],width:r.id.includes('b05')?34:28,rotation:'trajectory',mount:'projectile'}];
 else if(r.kind==='projectile')clips.projectile.components=[r.id==='ss-fx-void-bolt'?{part:'ss-boss-rift-marshal-violet',...parts['ss-boss-rift-marshal-violet'],width:22,rotation:'trajectory',mount:'projectile'}:{part:'blade-core',...parts['blade-core'],height:r.id==='ss-fx-shot'?32:r.id==='ss-fx-b01-lance'?76:r.id==='ss-fx-b04-lance'?82:44,tint:colour.blue,rotation:'trajectory',mount:'projectile'}];
 if(c.device)clips.active.components=[{part:c.device,...parts[c.device],width:48,mount:'ground',rotation:'none'}];
 const secondaryClips={};if(r.secondaryClips){const s=sources.steam;secondaryClips.phase_exhaust={kind:'atlas',sourceClip:'steam',image:s.image,atlas:s.atlas,frames:s.frames,fps:30,sourceDuration:s.duration,anchor:s.anchor,canvas:s.canvas,mount:'ss_exhaust',actorId:'ss-boss-core-extractor',layer:'front',loop:true,size:72,phaseOffsets:[0,.45],tint:colour.steam,blend:'source-over',starts:'phase-active',stops:['phase-end','death'],source:{...s.source.original,adoption:'Smoke slot only; original attachment/alpha timeline, neutral slot RGB; 2 offset cycles for visible flow; emitter follows actual ss_exhaust bone. No 31st root resource.'}};}
 const used=[...new Set([...Object.values(clips).filter(c=>c.kind==='atlas').map(c=>c.sourceClip),...Object.values(secondaryClips).map(c=>c.sourceClip)])],fs=used.flatMap(k=>sources[k].files),partFiles=Object.values(clips).flatMap(c=>c.components??[]).flatMap(c=>c.files??[]);
 const runtime={kind:'effect',clips,secondaryClips,timeline:{tickRate:30,parameters:'required resolved instance; no runtime defaults',reference:{...ref,source:r.rule.startsWith('AI/')?{path:'packages/simulation/index.ts',sha256:hash(simSource)}:{path:'packages/content/chapter-combat.ts',sha256:hash(ruleSource)}},events:{startup:'cast_started / danger_started',release:'cast_released',projectile:'real projectile snapshot',active:'effect_activated / actual zone snapshot / status_changed applied',impact:'hit_resolved only',end:'expired / effect-ended',interrupt:'cast_failed / interrupted',phase_exhaust:'phase-active until phase-end/death'},cosmeticExpiryTicks:12},mount:{startup:r.mount,release:r.mount,projectile:'independent executor position',impact:'actual contact point',active:'fixed ground snapshot or actual buff target'},geometry:{source:'resolved instance only',projection:[32,18],circle:'project Euclidean navigation-space circle',beam:'origin/direction/halfWidth/reach polygon',failure:'missing/invalid geometry disables warning and reports diagnostic, no radius fallback'},renderer:'/art/starsea/vfx/renderer.mjs',fixture:{actorId:actors[0],windupTicks:ref.windup,delayTicks:ref.delay,durationTicks:ref.duration,radius:ref.radius,...(r.kind==='beam'?{halfWidth:ref.halfWidth,reach:ref.reach}:{}),kind:r.kind,source:'reference snapshot only; not new enemy binding'}};
 const sourceFiles=used.flatMap(k=>sources[k].source.original.files),effectFile=resolve(pub,'effects',r.id+'.json');await mkdir(resolve(effectFile,'..'),{recursive:true});await writeFile(effectFile,JSON.stringify({id:r.id,name:r.name,rule:r.rule,runtime},null,2)+'\n');
 const retained=resolve(local,'runtime/effects',r.id+'.json');await mkdir(resolve(retained,'..'),{recursive:true});await copyFile(effectFile,retained);
 assets.push({id:r.id,name:r.name,type:'vfx',chapters:r.chapter,source:{mode:'adaptation',path:sources[used[0]].source.original.originalPath,sha256:sources[used[0]].source.original.sha256,nativeVersion:sources[used[0]].source.original.nativeVersion,adjustments:['Prioritized authorized 300-set library; all source material preserved.','Native region timelines baked as explicit source-layer adaptations; original full library animation not falsely claimed.','Precise danger geometry supplied separately from atlas texels.'],components:used.map(k=>sources[k].source)},files:[...new Map([...sourceFiles,...fs,...partFiles,await filespec(rel(effectFile))].map(f=>[f.path,f])).values()],runtime,actions:Object.keys(clips),states:{availableStages:Object.keys(clips).filter(k=>clips[k].kind!=='none'),secondaryClips:Object.keys(secondaryClips)},dependencies:actors,status:'producer-reviewed',notes:[r.mechanismStatus,ref.note,'All snapshots and effect events are supplied by integration; package does not emit damage, rewards or summons.'],preview:{url:'/art/starsea/vfx/preview.html?effect='+r.id,command:'node assets/starsea/vfx/tools/serve.mjs 8637'}});
}
const manifest={schemaVersion:1,group:'vfx',version:'starsea-20261003-vfx-v1',requirementsVersion:requirements.version,assets,shared:{renderer:'/art/starsea/vfx/renderer.mjs',actorRenderer:'/art/starsea/vfx/actor-preview.mjs',referenceFixtures:'/art/starsea/vfx/reference-fixtures.mjs',nativeSource:'/art/starsea/vfx/native-export.html',projection:[32,18],renderOwnership:'Ground/behind layers before actors; front/projectile/hit after actors.',warningTokens},limitations:['30 material entries complete; new actor rule binding and mainline gameplay not implemented here.','Whole original source files retained; selected layered exports omit source text and speed-line overlays and retime effect-only release/decay.','Reference preview fixtures do not modify game state or prove a combat mechanism.','Actual login/service compatibility/save preservation belongs to public integration acceptance.']};
await writeFile(resolve(local,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(resolve(pub,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const values={};function walk(obj,prefix){for(const[k,v]of Object.entries(obj)){if(v&&typeof v==='object'&&!('light'in v))walk(v,prefix?prefix+'-'+k:k);else values[(prefix?prefix+'-':'')+k]=v?.light??v;}}walk(tokens,'');
function expand(v){return String(v).replace(/\{([^}]+)\}/g,(_,k)=>expand(values[k.replaceAll('.','-')]));}
await writeFile(resolve(pub,'tokens.css'),':root{\n'+Object.entries(values).filter(([k])=>!k.startsWith('$')).map(([k,v])=>'--ss-'+k.toLowerCase()+':'+expand(v)+';').join('\n')+'\n}\n');
await writeFile(resolve(pub,'tokens.json'),JSON.stringify(tokens));
console.log(JSON.stringify({effects:assets.length,clips:Object.keys(sources).length,sourceLayers:'adaptation',uniqueRootIds:new Set(assets.map(a=>a.id)).size}));

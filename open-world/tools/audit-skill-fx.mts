import {readFile,writeFile,mkdir} from 'node:fs/promises';
import '../packages/content/open-world/index.ts';
import {regions,fieldRegionInfo,skillCatalog} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {monsterSkills,chapterBossSkills} from '../packages/content/chapter-combat.ts';
import {statusKindSchema} from '../packages/contracts/skill-mechanics.ts';
import {campSpawns} from '../packages/rules/world-camps.ts';
import {World,walkable} from '../packages/simulation/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {standard} from './standard-player-model.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import {visualSignature} from '../apps/web/src/vfx-motifs.ts';
const drawingFiles=['apps/web/src/combat-vfx.ts','apps/web/src/vfx-drawing.ts','apps/web/src/ground-zone-vfx.ts'];
const drawing=await Promise.all(drawingFiles.map(p=>readFile(p,'utf8'))),literalSet=new Set(drawing.join('\n').match(/['"][a-z][a-z0-9-]*['"]/g)?.map(s=>s.slice(1,-1))??[]);
let sounds:Record<string,unknown>={},motifs:Record<string,string>={};try{sounds=(await import('../apps/web/src/audio/sound-profiles.ts')).soundProfiles;}catch(error){if(!String(error).includes('Cannot find module'))throw error;}
try{motifs=(await import('../apps/web/src/vfx-motifs.ts')).motifSignatures;}catch(error){if(!String(error).includes('Cannot find module'))throw error;}
const keys=new Set<string>(),skills=new Set<string>(),statuses=new Set<string>(),runs=[];
for(const original of regions){
 const region=structuredClone(original),info=fieldRegionInfo(region.id),camp=worldTables.camps.find(c=>c.region===region.id),spawns=info&&camp?campSpawns(region,worldTables,camp,1):region.spawns.slice(0,12);if(!spawns.length){runs.push({region:region.id,ticks:0,spawns:0});continue;}
 const first=spawns[0];for(const radius of [3,4,5]){const p={x:first.x-radius,y:first.y};if(walkable(region,p,1)){region.safe=p;break;}}
 const level=Math.max(1,Math.min(60,first.monster?.level??1)),state=standard(level),build=resolveBuild(state),world=new World(region,{...build.stats,hp:1e8},build.resolvedSkills,spawns,[],41);world.setMode('auto');
 for(let i=0;i<120;i++){world.step();for(const e of world.events){if(e.vfxKey)keys.add(e.vfxKey);if(e.skill)skills.add(e.skill);if(e.status)statuses.add(e.status);}for(const item of [...world.projectiles,...world.zones,...world.bossCasts]){if(item.vfxKey)keys.add(item.vfxKey);if('skill' in item&&typeof item.skill==='string')skills.add(item.skill);}for(const s of world.statuses)statuses.add(s.effect.kind);}
 runs.push({region:region.id,ticks:world.tick,spawns:spawns.length});
}
const profiles=Object.values(vfxProfiles),categories=Object.fromEntries(['player','combo','monster','boss','status','system'].map(n=>[n,profiles.filter(p=>p.key.startsWith(n+'/')).length])),groups=new Map<string,string[]>();
for(const p of profiles.filter(p=>p.key.startsWith('player/'))){const signature=visualSignature(p);groups.set(signature,[...(groups.get(signature)??[]),p.key]);}
const production=JSON.parse(await readFile('packages/content/open-world/production.json','utf8')),islands=production.islands.map((island:any)=>{const templates=new Set(worldTables.camps.filter(c=>c.region===island.region.id).flatMap(c=>c.pack.map(p=>p.template)));for(const r of worldTables.rares.filter(r=>r.region===island.region.id))templates.add(r.template);for(const d of production.dungeons.filter((d:any)=>d.spec.island===island.meta.island))for(const spawn of d.region.spawns)if(spawn.monster)templates.add(spawn.monster.template);return {region:island.region.id,island:island.meta.island,chapter:island.meta.chapter,templates:[...templates].map(id=>{const t=monsterContent.templates.find(t=>t.id===id)!;return {id,name:t.name,role:t.role,kind:t.kind,skills:t.skills,bossKey:t.bossKey};})};});
const declared=new Set([...Object.keys(monsterSkills).map(k=>'monster/'+k),...Object.values(chapterBossSkills).flatMap((b:any)=>b.skills.map((s:any)=>'boss/'+s.id))]);
const report={generated:new Date().toISOString(),categories,playerSkills:skillCatalog.length,motifs:profiles.map(p=>({key:p.key,motif:p.motif,specific:Boolean(motifs[p.motif])||literalSet.has(p.motif)})),visualGroups:[...groups].map(([signature,keys])=>({signature,keys})),audio:{profiles:Object.keys(sounds).length,missing:profiles.filter(p=>!sounds[p.key]).map(p=>p.key)},events:{seed:41,runs,controls:'120 ticks per registered region, actual World/geometry/skills; controlled high player HP for coverage only, not balance evidence',vfxKeys:[...keys].sort(),skills:[...skills].sort(),statuses:[...new Set([...statuses,...statusKindSchema.options])].sort(),missingVfx:[...keys].filter(k=>!vfxProfiles[k]),missingDeclared:[...declared].filter(k=>!vfxProfiles[k])},islands};
await mkdir('docs',{recursive:true});await writeFile('docs/skill-audio-vfx-inventory.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({categories,regions:runs.length,observed:keys.size,missingVfx:report.events.missingVfx,missingDeclared:report.events.missingDeclared}));

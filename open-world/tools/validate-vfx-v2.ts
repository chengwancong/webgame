import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {skillCatalog} from '../packages/content/index.ts';
import {monsterSkills,chapterBossSkills} from '../packages/content/chapter-combat.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import source from '../packages/asset-manifest/skill-fx.json';
import extra from '../packages/asset-manifest/vfx-v2.json';
for(const skill of skillCatalog)if(!vfxProfiles['player/'+skill.id])throw Error('Unregistered player effect '+skill.id);
for(const id of Object.keys(monsterSkills))if(!vfxProfiles['monster/'+id])throw Error('Unregistered monster effect '+id);
for(const boss of Object.values(chapterBossSkills))for(const skill of boss.skills)if(!vfxProfiles['boss/'+skill.id])throw Error('Unregistered boss effect '+skill.id);
for(const [id,clip]of Object.entries(extra.clips)){
 const atlas=JSON.parse(readFileSync(resolve('apps/web/public'+clip.atlas),'utf8'));readFileSync(resolve('apps/web/public'+clip.image));
 for(let n=0;n<clip.count;n++)if(!atlas.frames[n])throw Error('Missing frame '+id+'/'+n);
 if(clip.distinctFrames!==clip.count)throw Error('Repeated animation frames '+id);
}
const rows=Object.values(vfxProfiles).map(p=>{
 for(const id of [p.clip,p.flight])if(!(id in source.clips)&&!(id in extra.clips))throw Error('Missing profile clip '+p.key+'/'+id);
 return {...p,registration:'explicit',presentationStatus:'implemented-awaiting-visual-review',gameplayScope:'Current executor only; presentation does not establish extra skill mechanics.',...(p.key==='monster/death_explosion'?{mechanicsGap:'Current monster executor has no death-explosion trigger; presentation registered but production trigger is not accepted.'}:{})};
});
const output=resolve('../docs/reviews/open-world/vfx-v2-20261001');mkdirSync(output,{recursive:true});writeFileSync(resolve(output,'coverage.json'),JSON.stringify({date:'2026-10-01',profiles:rows,assets:extra,knownPlayerMechanicsGaps:rows.filter(p=>p.key.startsWith('player/')&&p.mechanicsGap).map(p=>({key:p.key,reason:p.mechanicsGap}))},null,2));
console.log(JSON.stringify({registered:rows.length,players:skillCatalog.length,monsterSkills:Object.keys(monsterSkills).length,bossSkills:Object.values(chapterBossSkills).reduce((n,b)=>n+b.skills.length,0),newDistinctFrames:Object.values(extra.clips).reduce((n,c)=>n+c.distinctFrames,0)}));

import type {CharacterState} from '../../../packages/contracts/index.ts';
import type {StageKeyPreview} from '../../../packages/contracts/stage-keys.ts';
import type {FrozenStageKeyRewards} from './stage-key-rewards.ts';
import {ownedCrystalSources} from '../../../packages/rules/crystal-progress.ts';
import {aspectDefinitions} from '../../../packages/content/deep-progression.ts';
/** Compare actual rule mutations before the separate equal-enhancement try-on. */
export function stageKeyGrowth(before:CharacterState,after:CharacterState,frozen:FrozenStageKeyRewards):StageKeyPreview['growth']{
 const rows:StageKeyPreview['growth']=[],add=(label:string,a:number,b:number)=>{if(a!==b)rows.push({label,before:String(a),after:String(b)});},p=before.progression!,q=after.progression!;
 for(const [id,rank]of Object.entries(after.skillRanks))add((frozen.skills.find(s=>s.id===id)?.name??id)+' · 技能等级',before.skillRanks[id]??0,rank);
 if(JSON.stringify(before.skills)!==JSON.stringify(after.skills))rows.push({label:'装配技能',before:before.skills.map(id=>frozen.skills.find(s=>s.id===id)?.name??id).join('、')||'无',after:after.skills.map(id=>frozen.skills.find(s=>s.id===id)?.name??id).join('、')||'无'});
 for(const gear of before.gear){const next=after.gear.find(g=>g.id===gear.id);if(next)add(gear.name+' · 强化等级',gear.rank,next.rank);const a=p.weapons[gear.id],b=q.weapons[gear.id];if(a&&b){add(gear.name+' · 武器等级',a.level,b.level);add(gear.name+' · 突破阶',a.uncap,b.uncap);}}
 for(const [id,rank]of Object.entries(q.codex))add((aspectDefinitions.find(a=>a.id===id)?.name??id)+' · 法典等级',p.codex[id]??0,rank);
 for(const [id,next]of Object.entries(q.summons)){const label=frozen.summons.find(s=>s.id===id)?.name??id,old=p.summons[id];add(label+' · 等级',old?.level??0,next.level);add(label+' · 突破阶',old?.uncap??0,next.uncap);}
 for(const [id,rank]of Object.entries(q.glyphs))add((frozen.glyphs.find(g=>g.id===id)?.name??id)+' · 雕文等级',p.glyphs[id]??0,rank);
 add('巅峰累计成长',p.paragonLevel,q.paragonLevel);if(before.starsea&&after.starsea)add('星核共鸣',ownedCrystalSources(before,'core').length,ownedCrystalSources(after,'core').length);
 return rows;
}

import type {TacticalAction,TacticalCell,TacticalUnit} from '../../contracts/tactical.ts';
import {tacticalGraybox} from '../../content/tactical-content.ts';
import {spendTacticalAction} from './board.ts';
import {aligned,area,compareCells,direction,distance,hasLineOfSight,ray,sameCell} from './geometry.ts';
import {canControl,checkOutcome,damage,emit,heroOf,living,moveUnit,playerMultiplier,type Resolution,type TacticalEncounterState} from './runtime.ts';

export const heroSkills=Object.fromEntries(tacticalGraybox.heroes.map(hero=>[hero.id,hero.skillIds])) as Record<'sword'|'hidden',string[]>;
export const basicSkill=(s:TacticalEncounterState)=>tacticalGraybox.heroes.find(hero=>hero.id===s.heroId)!.basicSkillId;
type SkillId=keyof typeof tacticalGraybox.skills;
const directions=[{x:0,y:-1},{x:1,y:-1},{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:-1,y:-1}];
function targets(s:TacticalEncounterState,id:string,target?:TacticalCell):TacticalUnit[]{
 const hero=heroOf(s),enemies=living(s).filter(u=>u.side==='enemy');
 if(id==='ward')return [];
 if(id==='whirl'||id==='vortex_blade')return enemies.filter(u=>distance(hero.cell,u.cell)<=tacticalGraybox.skills[id].range&&hasLineOfSight(s.board,hero.cell,u.cell));
 if(!target)throw Error('Target required');
 const skill=tacticalGraybox.skills[id as SkillId];
 if(distance(hero.cell,target)>skill.range||!hasLineOfSight(s.board,hero.cell,target))throw Error('Target is out of range or sight');
 if(id==='cut'){const unit=enemies.find(u=>sameCell(u.cell,target));if(!unit||distance(hero.cell,target)!==1)throw Error('No adjacent enemy');return [unit];}
 if(id==='toxic_bomb')return enemies.filter(u=>area(s.board,target,1).some(c=>sameCell(c,u.cell)));
 if(sameCell(hero.cell,target)||!aligned(hero.cell,target))throw Error('Choose one of the eight ray directions');
 const dir=direction(hero.cell,target);
 const hit=(d:TacticalCell,piercing=false)=>{const cells=ray(s,hero.cell,d,skill.range);const found=cells.map(c=>enemies.find(u=>sameCell(c,u.cell))).filter((u):u is TacticalUnit=>!!u);return piercing?found:found.slice(0,1);};
 if(id==='fan_of_knives'){const at=directions.findIndex(d=>sameCell(d,dir));return [...new Map([at,(at+7)%8,(at+1)%8].flatMap(i=>hit(directions[i])).map(u=>[u.id,u])).values()];}
 return hit(dir,id==='venom_needle');
}
export function validateTacticalSkill(s:TacticalEncounterState,action:Extract<TacticalAction,{type:'basic'|'skill'}>){
 const id=action.type==='basic'?basicSkill(s):action.skillId,hero=heroOf(s);
 if(!(heroSkills[s.heroId] as readonly string[]).includes(id))throw Error('Unknown hero skill');
 if(action.type==='skill'&&id===basicSkill(s))throw Error('Basic skill requires basic action');
 if(s.budget.mainActionUsed||s.budget.ended)throw Error('Main action already used');
 if((hero.cooldowns[id]??0)>s.round)throw Error('Skill is cooling down');
 const found=targets(s,id,action.target);
 if(id!=='ward'&&id!=='toxic_bomb'&&!found.length)throw Error('No target in skill shape');
 return {id:id as SkillId,targets:found};
}
export function executeTacticalSkill(r:Resolution,action:Extract<TacticalAction,{type:'basic'|'skill'}>){
 const s=r.state,hero=heroOf(s),valid=validateTacticalSkill(s,action),config=tacticalGraybox.skills[valid.id];
 s.budget=spendTacticalAction(s.budget,action.type);
 hero.cooldowns[valid.id]=s.round+config.cooldown;
 emit(r,'skill',valid.id,{targetId:hero.id,cell:action.target});
 if(valid.id==='ward'){
  hero.shield=Math.max(hero.shield,tacticalGraybox.skills.ward.shield!);
  hero.statuses=hero.statuses.filter(t=>t.id!=='ward');hero.statuses.push({id:'ward',sourceId:hero.id,remaining:1,amount:hero.shield,expiresOnRound:s.round+1,rootActionId:r.actionId});
  emit(r,'shield','ward',{targetId:hero.id,amount:hero.shield});return;
 }
 if(valid.id==='toxic_bomb'){
  const config=tacticalGraybox.skills.toxic_bomb;
  s.zones.push({id:`${r.actionId}:poison`,kind:'poison',sourceId:hero.id,cells:area(s.board,action.target!,1),damage:config.zoneDamage!,remaining:config.duration!,activeFromRound:s.round,rootActionId:r.actionId});return;
 }
 if(valid.id==='vortex_blade')for(const enemy of [...valid.targets].sort((a,b)=>distance(hero.cell,a.cell)-distance(hero.cell,b.cell)||a.id.localeCompare(b.id))){
  if(distance(hero.cell,enemy.cell)<=1||!canControl(enemy))continue;
  const to=area(s.board,hero.cell,1).filter(c=>!living(s).some(u=>sameCell(u.cell,c))&&hasLineOfSight(s.board,enemy.cell,c)).sort((a,b)=>distance(enemy.cell,a)-distance(enemy.cell,b)||compareCells(a,b))[0];
  if(to){enemy.cell={...to};emit(r,'pull','vortex-blade',{targetId:enemy.id,cell:to});}
 }
 const multiplier=playerMultiplier(s);
 for(const enemy of valid.targets){
  damage(r,enemy,config.damage*multiplier,valid.id,hero);
  if(valid.id==='venom_needle'&&enemy.hp>0){
   const poison=tacticalGraybox.skills.venom_needle;enemy.statuses=enemy.statuses.filter(t=>t.id!=='poison');enemy.statuses.push({id:'poison',sourceId:hero.id,remaining:poison.dotTicks!,amount:poison.dotDamage!,rootActionId:r.actionId});
  }
 }
 checkOutcome(s);
}
/** Enumerates targets, using the exact same validator as a submitted command. */
export function legalTacticalMainActions(s:TacticalEncounterState):TacticalAction[]{
 if(s.outcome||s.budget.ended||s.budget.mainActionUsed)return [];
 const result:TacticalAction[]=[];
 for(const id of heroSkills[s.heroId]){
  const self=id==='whirl'||id==='ward'||id==='vortex_blade';
  const cells=self?[undefined]:Array.from({length:s.board.width*s.board.height},(_,i)=>({x:i%s.board.width,y:Math.floor(i/s.board.width)}));
  const seen=new Set<string>();
  for(const target of cells){
   const a:TacticalAction=id===basicSkill(s)?{type:'basic',target:target!}:{type:'skill',skillId:id,...(target?{target}:{})};
   try{validateTacticalSkill(s,a as Extract<TacticalAction,{type:'basic'|'skill'}>);
    // Ray clicks sharing a direction have exactly the same rules result.
    const key=(id==='throwing_knife'||id==='fan_of_knives'||id==='venom_needle')?JSON.stringify(direction(heroOf(s).cell,target!)):JSON.stringify(target);
    if(!seen.has(key)){seen.add(key);result.push(a);}
   }catch{/* An illegal target is simply absent from the legal action list. */}
  }
 }
 return result;
}

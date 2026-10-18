import type {Condition,ConditionContext} from '../contracts/conditions.ts';
const compare=(op:string,a:number,b:number)=>op==='lt'?a<b:op==='lte'?a<=b:op==='gt'?a>b:a>=b;
/** Shared deterministic condition evaluator. Missing target/skill cannot match. */
export function matches(cond:Condition,ctx:ConditionContext):boolean{
 if(ctx.upperBound)return true;
 switch(cond.kind){
 case 'all':return cond.conditions.every(c=>matches(c,ctx));case 'any':return cond.conditions.some(c=>matches(c,ctx));case 'not':return !matches(cond.condition,ctx);
 case 'skill':{const s=ctx.skill;return !!s&&(!cond.skills||cond.skills.includes(s.id))&&(!cond.tags||cond.tags.some(t=>s.tags?.includes(t)))&&(!cond.weapons||cond.weapons.includes(s.weapon??''))&&(!cond.damageTypes||cond.damageTypes.includes(s.damageType??''))&&(!cond.longest||!!s.longest);}
 case 'target_status':return !!ctx.target&&cond.statuses.some(s=>(ctx.target!.statuses[s]??0)>=(cond.minStacks??1));
 case 'target_rank':return !!ctx.target&&cond.ranks.includes(ctx.target.rank);
 case 'target_hp':return !!ctx.target&&compare(cond.op,ctx.target.hp,cond.value);case 'self_hp':return compare(cond.op,ctx.self.hp,cond.value);
 case 'distance':return !!ctx.target&&compare(cond.op,ctx.target.distance,cond.value);case 'crowd':return compare(cond.op,ctx.nearbyDistances?.filter(d=>d<=(cond.radius??4)).length??ctx.target?.crowd??0,cond.value);case 'cast_hits':return compare(cond.op,ctx.castHits??0,cond.value);case 'combat_time':return compare(cond.op,ctx.combatTime,cond.value);
 case 'self_state':{const s=ctx.self,v=cond.value??0;switch(cond.state){case 'shield':return s.shield>0;case 'moving':return s.moving>v;case 'still':return s.still>=v;case 'mana':return s.mana>=v;case 'buff':return s.buffs.includes(cond.id??'');case 'kills':return s.kills>=v;case 'manaSpent':return s.manaSpent>=v;}}
 }
}

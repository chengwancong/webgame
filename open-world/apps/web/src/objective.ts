import type {BossAccess} from '../../../packages/contracts/index.ts';
// Player-facing copy consumes server-resolved eligibility for the current area.
export function objectiveCopy(input:{kills:number;bosses:string[];regionId:string;regionBoss:boolean;subtitle:string;access?:BossAccess}){
 if(input.regionId==='town')return {head:'整理后再出发',progress:'营地',detail:'行囊在营地里，出城从远行入口离开。'};
 if(input.regionBoss)return {head:'首领战进行中',progress:'注意重击预警',detail:input.subtitle||'地面出现危险圈后先走开，再继续输出。'};
 const access=input.access;
 if(!access)return {head:'同步清剿进度',progress:'等待确认',detail:'准入信息未就绪，请恢复连接。'};
 if(!access.eligible){const eliteOnly=access.kills>=access.requiredKills;return {head:eliteOnly?'击败地区精英':'清剿敌群',progress:eliteOnly?`${Math.min(access.elites,access.requiredElites)}/${access.requiredElites}`:`${Math.min(access.kills,access.requiredKills)}/${access.requiredKills}`,detail:access.message};}
 if(!access.cleared)return {head:'前往首领结界',progress:'清剿已完成',detail:'本地区敌人与精英清剿已完成。沿主路走向结界，确认后再进入。'};
 return {head:'继续探索',progress:'首领已通关',detail:'可以回营地选择下一区域，或继续清剿、再次挑战已解锁首领。'};
}

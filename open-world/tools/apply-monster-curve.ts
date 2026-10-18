// 数值来源已迁到 tools/spine；此入口校验并复用主干已应用计划。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {MonsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterContent} from '../packages/content/monsters.ts';
import {monsterLevelValues} from '../packages/rules/monster-stats.ts';
import {armorMitigation} from '../packages/rules/combat-numerics.ts';
import {auditMeasuredModel,auditNumericFlow} from './numeric-source-audit.ts';
import {deriveSwarmLines} from './swarm-health-line.ts';
import {proposeStarterSwarmRoles} from './swarm-role-proposal.ts';
import {starseaCampaign} from '../packages/content/starsea/index.ts';
export type StandardCurveRow={level:number;full:{dps1:number;ehp:number;hitAoe:number;hp:number;armor:number};monster:{current:{armor:number}}};
export const normalCurvePolicy={baseTtk:2.5,floor:.28,weight:.72,decayLevels:16,capLevel:50,combatEfficiency:.75,timeToDie:40,attackIntervalSeconds:3};
export function normalTargetTtk(level:number,policy=normalCurvePolicy){return policy.baseTtk*(policy.floor+policy.weight*Math.exp(-(Math.min(level,policy.capLevel)-1)/policy.decayLevels));}
/** Invert the actual armour owner rather than reusing EHP measured against an
 * old attack curve. This matters for the nonlinear hit-ratio armour model. */
export function attackForArmoredHit(targetDamage:number,armor:number){
 if(!Number.isFinite(targetDamage)||targetDamage<=0||!Number.isFinite(armor)||armor<0)throw Error('Invalid actual armour hit target');
 const target=Math.max(1,Math.round(targetDamage));let low=1,high=Math.max(1,target);
 while(armorMitigation(high,armor).damage<target){high*=2;if(!Number.isSafeInteger(high))throw Error('Armoured hit target exceeds supported precision');}
 while(low<high){const middle=low+Math.floor((high-low)/2);if(armorMitigation(middle,armor).damage>=target)high=middle;else low=middle+1;}
 return {attack:low,targetDamage:target,actualDamage:armorMitigation(low,armor).damage};
}
/** Template ratios are retained while their reference bases are moved with the
 * curve. Changing only curve points would cancel at every reference level. */
export function deriveMonsterCurve(content:MonsterContent,rows:readonly StandardCurveRow[],policy=normalCurvePolicy){
 if(rows.length!==60||rows.some((row,i)=>row.level!==i+1||![row.full.dps1,row.full.ehp,row.full.hitAoe,row.full.hp].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(row.full.armor)||row.full.armor<0))throw Error('Expected60 actual standard rows including hitAoe and resolved HP/armour');
 const next=structuredClone(content),previous=content.curves.starsea,projection:{level:number;rawHp:number;hp:number;rawAttack:number;attack:number}[]=[];
 if(!previous)throw Error('No authored starsea curve');
 const curve=rows.map(row=>{const rawHp=row.full.dps1*policy.combatEfficiency*normalTargetTtk(row.level,policy),rawAttack=attackForArmoredHit(row.full.hp/policy.timeToDie*policy.attackIntervalSeconds,row.full.armor).attack,prior=projection.at(-1),hp=Math.max(rawHp,prior?.hp??0),attack=Math.max(rawAttack,prior?.attack??0);projection.push({level:row.level,rawHp,hp,rawAttack,attack});return {level:row.level,hp,attack,armor:Math.max(1,row.monster.current.armor)};});
 next.curves.starsea=curve;
 for(const template of next.templates.filter(t=>t.curve==='starsea')){const old=monsterLevelValues('starsea',template.referenceLevel,content),current=monsterLevelValues('starsea',template.referenceLevel,next);template.base={hp:template.base.hp*current.hp/old.hp,attack:template.base.attack*current.attack/old.attack,armor:template.base.armor*current.armor/old.armor};}
 next.ranks.elite={...next.ranks.elite,hp:4,attack:2};next.ranks.rare={...next.ranks.rare,hp:8,attack:2};
 resolveMonsterContent(next);return {content:next,projection,policy,source:'actual resolved standard measurements; monotonic projection reported separately'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {legacySpineEntry}=await import('./spine/legacy.ts');await legacySpineEntry('apply-monster-curve');
}

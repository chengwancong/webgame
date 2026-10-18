import type {DungeonDefinition} from '../contracts/dungeons.ts';
/** Resolve at catalogue/creation only; saved runs keep this exact definition. */
export function characterDungeonDefinition(source:DungeonDefinition,hardmode:boolean,worldTier=1){
 if(!hardmode||!source.hardmode)return source;
 const d=structuredClone(source),mode=d.hardmode!;d.numericStage=mode.numericStage;d.level=mode.level;d.policy.entryLevel=mode.level;d.policy.monsterLevel=mode.monsterLevel;d.policy.enemyScale={...d.policy.enemyScale,...mode.enemyScale};if(mode.stageEnemyScale)d.policy.stageEnemyScale=structuredClone(mode.stageEnemyScale);if(mode.worldTierScalingFrom&&worldTier>=mode.worldTierScalingFrom)d.worldTierScaling=true;return d;
}

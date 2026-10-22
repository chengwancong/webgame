/** 成功回执后触发；按钮音不能冒充强化/分解成功。 */
export const receiptSounds:readonly [RegExp,string][]=[
 [/^gear\/unequip$/,'ui/unequip'],[/^gear\/equip$/,'ui/equip-metal'],[/^gear\/.*lock$/,'ui/lock'],[/^gear\/salvage$/,'ui/salvage-material'],[/^gear\/.*salvage/,'ui/salvage-batch'],[/^reward\/claim/,'ui/reward-end'],[/^gear\/.*upgrade/,'ui/forge-success'],[/^gear\/.*(?:reforge|reroll)/,'ui/reforge'],[/^skills\/.*activate/,'ui/skill-learn'],[/^skills\/.*upgrade/,'ui/skill-upgrade'],[/^skills$/,'ui/skill-slot'],[/^progression\/.*reset/,'ui/talent-reset'],[/^progression\//,'ui/talent-add'],[/^appearance/,'ui/outfit'],[/^quest\/.*accept/,'world/quest-accept'],[/^quest\/.*claim/,'stinger/quest-complete'],[/^task\/claim/,'stinger/quest-complete'],[/^stage-keys\/craft/,'cue/pickup-key'],[/^bounty\/claim/,'stinger/quest-complete'],[/^(world|travel)\/.*waypoint/,'world/teleport-activate']];

/** 当前数据没有护甲材质字段：按装备名称关键字判断布/皮，其余走金属。 */
export function equipSound(gear?:{name:string;slot:string}){const name=gear?.name??'';if(/布|袍|丝|绸|法衣|织/.test(name))return 'ui/equip-cloth';if(/皮|革|猎|靴/.test(name)||gear?.slot==='boots')return 'ui/equip-leather';return 'ui/equip-metal';}
export function receiptSound(path:string,body:object,lookup?:(id:string)=>{name:string;slot:string}|undefined){if(path==='gear/equip'&&lookup)return equipSound(lookup((body as {gear_id?:string}).gear_id??''));if(path==='quest'){const op=(body as {op?:string}).op;return ({accept:'world/quest-accept',complete:'stinger/quest-complete',waypoint:'stinger/discovery',clue:'stinger/clue',talk:'world/dialogue'} as Record<string,string>)[op??''];}return receiptSounds.find(([pattern])=>pattern.test(path))?.[1];}
/** 锻造类命令被服务端拒绝时的失败音（锻造无随机失败，失败即被拒绝的回执）。 */
export const forgeFailureSound=(path:string)=>/^gear\/.*(?:upgrade|reroll|reforge)/.test(path)?'ui/forge-fail':undefined;

/** 锻造类命令发出时的“进行中”音（强化/重铸/制作）。 */
export const forgeWorkingSound=(path:string)=>/^gear\/.*(?:upgrade|reroll|reforge)|^crafting\/action$/.test(path)?'ui/forge-working':undefined;
/** 分解回执里带回铭纹拓片材料时，追加铭纹音。 */
export const inscriptionSound=(path:string,delta?:{progression?:{materials?:Record<string,number>}})=>/^gear\/.*salvage/.test(path)&&Object.values(delta?.progression?.materials??{}).some(n=>n>0)?'ui/inscription':undefined;
/** 同一键在 gap 毫秒内只放行一次，避免面板刷屏。 */
export class SoundGate{private last=new Map<string,number>();allow(key:string,now:number,gap=400){const prev=this.last.get(key);if(prev!==undefined&&now-prev<gap)return false;this.last.set(key,now);return true;}}

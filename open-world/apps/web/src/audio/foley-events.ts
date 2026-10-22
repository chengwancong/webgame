/** AUDIO-W04：foley 触发规则（纯函数，便于单测）。只做映射与去抖，不合成新音。 */
const materials:Record<string,string>={beast:'flesh','dusk-humanoid':'flesh',pirate:'flesh',plant:'flesh',machine:'metal','frost-guard':'metal','dragon-oath':'stone','fire-spirit':'spirit',rift:'spirit'};
/** 怪物身体分组（body-map.json 的 group）→ 命中音材质；未知分组不播。 */
export const hitMaterial=(group:string|undefined)=>group?materials[group]:undefined;
/** 单次伤害 ≥ 最大生命 15% 视为重击受击。 */
export const hurtKey=(amount:number,maxHp:number)=>amount>0&&maxHp>0&&amount>=maxHp*.15?'foley/hurt-heavy':'foley/hurt';
/** 同类音效最短间隔 80ms（按模拟 tick，30 tick/s）。 */
export class FoleyGate{private last=new Map<string,number>();constructor(private readonly gapMs=80,private readonly tickRate=30){}
 allow(key:string,tick:number){const old=this.last.get(key);if(old!==undefined&&tick>=old&&(tick-old)*1000/this.tickRate<this.gapMs)return false;this.last.set(key,tick);return true;}
 clear(){this.last.clear();}}
/** AUDIO-W05：词缀生效瞬间（怪物释放词缀技能）→ 冲击音；必须确认该怪确实带对应词缀，避免模板自带同名技能误播。swift 无独立事件，不映射。 */
const affixSkills:Record<string,[string,string]>={frost_nova:['frost_nova','affix/frost-nova'],elite_fire_trail:['fire_trail','affix/fire-trail'],summon_undead:['summon_minions','affix/summon'],elite_teleport:['teleport','affix/teleport']};
export const affixImpact=(skill:string|undefined,affixes:readonly string[]|undefined)=>{const row=skill?affixSkills[skill]:undefined;return row&&affixes?.includes(row[0])?row[1]:undefined;};
/** 赶路环境音：同一时刻最多每 8 秒一次（按毫秒时钟）。 */
export const TRAVEL_AMBIENCE_GAP_MS=8000;

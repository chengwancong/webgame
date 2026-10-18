import selection from '../apps/api/src/stage-key-selection.json';
const slots:Record<string,string>={weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',accessory:'项链',ring:'戒指'};
const mechanisms:Record<string,string>={skill:'适配主手的当前技能成长',enhance:'已装备物品强化',codex:'兼容主手的法典威能',weapon_uncap:'已装备主手突破',summon:'召唤石成长',cores:'星核共鸣',paragon:'真实巅峰点',glyph:'已用雕文成长'};
/** Authoring-only copy. The generated private pool remains the runtime content source. */
export function stageKeyDescription(name:string,outputs:readonly {kind:string;slot?:string;quality?:string;count?:number}[],stage:number){
 const gear=outputs.filter(o=>o.kind==='gear'),parts=[...new Set(gear.flatMap(o=>(o.count??1)>1?selection.setSlots.slice(0,o.count):[o.slot!]).map(s=>slots[s]))];
 const direction=[...new Set(outputs.map(o=>{const text=o.kind==='gear'?o.quality==='legendary'?'传奇威能与副属性':'本阶段基础属性与副属性':mechanisms[o.kind];if(!text)throw Error('Missing key output copy '+o.kind);return text;}))].join('、');
 if(!direction||direction.includes('undefined'))throw Error('Missing key output copy');
 return `${name}。部位：${parts.join('、')||'现有成长'}；机制方向：${direction}；阶段用途：补足第 ${stage} 阶段的当前构筑。${gear.length?'谱系适配当前主手；请用同强化预览选择取舍。':'具体成长变化可预览。'}仅由本阶段地城掉落或制作。`;
}

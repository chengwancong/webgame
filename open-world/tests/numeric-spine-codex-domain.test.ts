import {it,expect} from 'vitest';
import {buildSourcePartsSchema} from '../packages/contracts/build-sources.ts';
import {scaleAspectParts} from '../packages/rules/aspect-sources.ts';
import {standardState,resolvePlayer} from '../tools/spine/player.ts';
it('法典成长保留既定扣伤代价，不能将合法伤害倍率变成负数',()=>{
 const parts=buildSourcePartsSchema.parse({patches:[{skills:['throwing_knife'],ops:[{path:'damage',op:'mul',value:.05}]}]});
 for(const rank of [1,3,5])expect(scaleAspectParts(parts,rank).patches[0].ops[0].value).toBe(.05);
});
it('正向伤害收益仍沿用每级法典增加10%的成长',()=>{
 const parts=buildSourcePartsSchema.parse({patches:[{skills:['throwing_knife'],ops:[{path:'damage',op:'mul',value:1.2}]}]});expect(scaleAspectParts(parts,5).patches[0].ops[0].value).toBe(1.28);
});
it('真实高阶暗器标准配置可完整解析，所有已装配伤害保持非负',()=>{
 for(const level of [40,50]){const p=resolvePlayer('codex-domain-'+level,standardState(level,'hidden'));expect(p.build.skills.map(s=>s.id)).toEqual(['throwing_knife','fan_of_knives','ward']);expect(p.build.skills.every(s=>Number.isSafeInteger(s.damage)&&s.damage>=0)).toBe(true);}
});

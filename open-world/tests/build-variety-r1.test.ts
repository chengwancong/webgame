import {createHash} from 'node:crypto';
// 全参数与全帧原样参与比较；大体积原始轨迹留本地，入库固定SHA256期望。
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
import {combatOutcomeEvents} from './fixtures/combat-outcome-events.ts';
import {it,expect} from 'vitest';
import rows from './fixtures/build-variety-r1/legacy-builds.json';
import golden from './fixtures/numeric-spine/legacy-builds-summary.json';
import {statRegistry,statDefinitionSchema} from '../packages/contracts/stats.ts';
import {affixStatSchema,affixDisplayValue,validAffixValue} from '../packages/contracts/affix-units.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {foldZones} from '../packages/rules/damage-zones.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
it.each(rows)('$weapon current spine build and every frame match the versioned golden',row=>{const build=resolveBuild(structuredClone(row.state) as unknown as CharacterState);expect(digest(build)).toBe(golden.find(g=>g.weapon===row.weapon)!.build);const w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},build.stats,build.resolvedSkills,[{id:'target',name:'靶',x:12,y:10,hp:1000000,attack:3,kind:'melee',elite:false,boss:false,art:'raider'}],[],41);w.setMode('auto');const events=[];for(let i=0;i<300;i++){w.step();events.push(...w.events.filter(e=>e.type!=='effect_triggered').map(({ruleId,source,action,...event})=>event));}expect(digest(combatOutcomeEvents(events))).toBe(golden.find(g=>g.weapon===row.weapon)!.events);});
it.each(statRegistry.filter(s=>s.affix))('$id has unique units and display registration',s=>{statDefinitionSchema.parse(s);expect(affixStatSchema.parse(s.id)).toBe(s.id);expect(validAffixValue(s.id,.2)).toBe(true);expect(affixDisplayValue(s.id,.2)).toBe(s.display==='multiplier'?'×0.2':s.unit==='seconds'?'0.2秒':s.unit==='ratio'?'20%':'0.2');});
it('folds type sums and independent products once',()=>{expect(foldZones([{id:'a',label:'a',kind:'add',pool:'type',value:.1},{id:'b',label:'b',kind:'add',pool:'type',value:.2},{id:'c',label:'c',kind:'mult',pool:'mult',value:1.5},{id:'d',label:'d',kind:'mult',pool:'mult',value:2}])).toEqual({damageAdd:.3,damageMult:3});});

import {registeredStatShape} from '../packages/contracts/stats.ts';
import {z} from 'zod';
it('rejects contradictory damage pools and skill modifiers hidden in set stats',()=>{expect(()=>foldZones([{id:'bad',label:'bad',kind:'add',pool:'mult',value:.2}])).toThrow();const set=z.object(registeredStatShape).strict();expect(()=>set.parse({critChance:1.1})).toThrow();expect(()=>set.parse({skillCooldown:.3})).toThrow();expect(set.parse({critMultiplier:2,hp:.15})).toEqual({critMultiplier:2,hp:.15});});

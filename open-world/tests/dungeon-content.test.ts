import {it,expect} from 'vitest';
import source from '../packages/content/dungeons.json';
import {resolveDungeonContent} from '../packages/content/dungeons.ts';
it('inherits only declared defaults and respects nested per-dungeon overrides after references',()=>{
 const raw=structuredClone(source) as any;raw.definitions.find((d:any)=>d.id==='raid-abyss-live').policy={timeLimitSeconds:93,retention:{seconds:41},party:{min:2,max:2,roles:{damage:2}},rescue:{seconds:1.25,hpRatio:.42},enemyScale:{hp:2.4},quota:{pool:'custom',period:'day',limit:7}};
 const d=resolveDungeonContent(raw).definitions.find(d=>d.id==='raid-abyss-live')!;expect(d.policy.timeLimitSeconds).toBe(93);expect(d.policy.retention).toEqual({enabled:true,seconds:41});expect(d.policy.party).toEqual({min:2,max:2,roles:{damage:2},defaultRole:'damage'});expect(d.policy.rescue).toEqual({seconds:1.25,hpRatio:.42,range:2});expect(d.policy.enemyScale.hp).toBe(2.4);expect(d.quota).toEqual({pool:'custom',period:'day',limit:7});
});
it('rejects unknown profiles/maps, unsupported modes and incompatible retention without silent fallback',()=>{
 const mutate=(fn:(raw:any)=>void)=>{const raw=structuredClone(source);fn(raw);return ()=>resolveDungeonContent(raw);};expect(mutate(raw=>raw.definitions[0].profiles=['not-real'])).toThrow();expect(mutate(raw=>raw.definitions[0].stages=['not-real'])).toThrow();expect(mutate(raw=>raw.profiles.realtime.mode='paused')).toThrow();expect(mutate(raw=>raw.defaults.retention.enabled=false)).toThrow();
});
it('rejects impossible targets, recursive prerequisites and unknown rule names',()=>{const mutate=(fn:(raw:any)=>void)=>{const raw=structuredClone(source);fn(raw);return ()=>resolveDungeonContent(raw);};expect(mutate(raw=>raw.definitions.find((d:any)=>d.id==='normal-meadow').policy={normalGoals:{killCount:999}})).toThrow();expect(mutate(raw=>raw.definitions[0].requires=[raw.definitions[0].id])).toThrow();expect(mutate(raw=>raw.defaults.hiddenFallback=42)).toThrow();});

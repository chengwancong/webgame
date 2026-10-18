import {it,expect} from 'vitest';
import raw from '../packages/content/dungeons.json';
import {resolveDungeonContent,dungeonContent,resolveRunAugmentPolicy} from '../packages/content/dungeons.ts';
it('inherits augment defaults through named profiles and per-dungeon overrides without a story-ID exception',()=>{
 const source=structuredClone(raw) as any;source.profiles['test-augment-policy']={augments:{rerolls:2,roundCount:2}};const entry=source.definitions.find((d:any)=>d.id==='normal-meadow');entry.profiles.push('test-augment-policy');entry.policy={...entry.policy,augments:{rerolls:3}};
 const resolved=resolveDungeonContent(source).definitions.find(d=>d.id===entry.id)!;expect(resolved.policy.augments).toEqual({enabled:true,choices:3,rerolls:3,roundCount:2});expect(resolveRunAugmentPolicy(resolved,1).policy).toMatchObject({rerolls:3});expect(resolveRunAugmentPolicy(resolved,1).policy.rounds).toHaveLength(2);
 const story=source.definitions.find((d:any)=>d.story);story.policy={...story.policy,augments:{enabled:true,roundCount:1}};expect(resolveDungeonContent(source).definitions.find(d=>d.id===story.id)!.policy.augments).toMatchObject({enabled:true,roundCount:1});
});
it('keeps declared disabled story and custom profiles disabled even in world IV',()=>{
 expect(dungeonContent.definitions.filter(d=>d.story).every(d=>d.policy.augments?.enabled===false)).toBe(true);
 const source=structuredClone(raw) as any;source.definitions.find((d:any)=>d.id==='normal-meadow').policy={augments:{enabled:false}};const d=resolveDungeonContent(source).definitions.find(d=>d.id==='normal-meadow')!;expect(resolveRunAugmentPolicy(d,4).policy.enabled).toBe(false);expect(resolveRunAugmentPolicy(d,4).policy.rounds).toEqual([]);
});
it('world IV adds one private same-tier round and keeps earlier creation snapshots unchanged',()=>{
 const d=dungeonContent.definitions.find(d=>d.id==='normal-meadow')!,normal=resolveRunAugmentPolicy(d,3),higher=resolveRunAugmentPolicy(d,4),before=structuredClone(higher);
 expect(normal.policy.rounds).toHaveLength(3);expect(higher.policy.rounds).toHaveLength(4);expect(higher.extra?.bossHpRatio).toBe(.5);expect(higher.policy.rounds[3]).toEqual([{tier:'gold',weight:70},{tier:'prismatic',weight:30}]);expect(higher).toEqual(before);expect(d.policy.augments!.roundCount).toBe(3);
});
it('rejects unsupported declared counts and lets the configured master switch disable selection',()=>{
 const source=structuredClone(raw) as any;source.definitions.find((d:any)=>d.id==='normal-meadow').policy={augments:{roundCount:9}};expect(()=>resolveDungeonContent(source)).toThrow('Unsupported');source.definitions.find((d:any)=>d.id==='normal-meadow').policy={augments:{roundCount:3}};source.augments.enabled=false;expect(resolveDungeonContent(source).definitions.every(d=>d.policy.augments?.enabled===false)).toBe(true);
});

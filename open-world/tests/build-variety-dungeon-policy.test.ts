import {it,expect} from 'vitest';
import raw from '../packages/content/dungeons.json';
import {resolveDungeonContent,dungeonContent,dungeonContentSchema} from '../packages/content/dungeons.ts';
import {dungeonCommandSchema,dungeonViewSchema,resolvedDungeonPolicySchema} from '../packages/contracts/dungeons.ts';
import {hubDungeonTemplateSchema} from '../packages/contracts/hub-dungeons.ts';

it('inherits ordinary policy defaults, named profiles and per-dungeon overrides without in-run picks',()=>{
 const source=structuredClone(raw) as any;
 source.profiles['test-entry-policy']={entryCost:{gold:2},rescue:{hpRatio:.5}};
 const entry=source.definitions.find((d:any)=>d.id==='normal-meadow');
 entry.profiles.push('test-entry-policy');entry.policy={...entry.policy,entryCost:{gold:3}};
 const resolved=resolveDungeonContent(source).definitions.find(d=>d.id===entry.id)!;
 expect(resolved.policy.entryCost).toEqual({gold:3,material:raw.defaults.entryCost.material});
 expect(resolved.policy.rescue.hpRatio).toBe(.5);
 expect(resolved.policy).not.toHaveProperty('augments');
});
it('has no pick policy or pick rounds in authored or generated dungeon templates',()=>{
 expect(raw).not.toHaveProperty('augments');expect(raw).not.toHaveProperty('augmentExtra');
 expect(raw.defaults).not.toHaveProperty('augments');expect(raw.profiles).not.toHaveProperty('augments-disabled');
 const hub=dungeonContent.definitions.filter(d=>d.hub);expect(hub).toHaveLength(60);
 for(const definition of dungeonContent.definitions){
  expect(definition.policy).not.toHaveProperty('augments');
  if(definition.hub){expect(definition.hub).not.toHaveProperty('augmentRounds');hubDungeonTemplateSchema.parse(definition.hub);}
 }
});
it('rejects old pick fields even when disabled instead of retaining a hidden feature switch',()=>{
 const legacy={enabled:false,choices:3,rerolls:0,rounds:[]};
 expect(dungeonContentSchema.safeParse({...raw,augments:legacy}).success).toBe(false);
 expect(dungeonContentSchema.safeParse({...raw,augmentExtra:{minimumWorldTier:4}}).success).toBe(false);
 const source=structuredClone(raw) as any;
 source.profiles['old-pick-profile']={augments:{enabled:false}};
 expect(()=>resolveDungeonContent(source)).toThrow();
 const definition=dungeonContent.definitions[0];
 expect(resolvedDungeonPolicySchema.safeParse({...definition.policy,augments:{enabled:false}}).success).toBe(false);
 expect(hubDungeonTemplateSchema.safeParse({...dungeonContent.definitions.find(d=>d.hub)!.hub,augmentRounds:1}).success).toBe(false);
});
it('rejects removed choose and reroll commands and their obsolete payload fields',()=>{
 const base={command_id:'00000000-0000-4000-8000-000000000001',lease_id:'00000000-0000-4000-8000-000000000002'};
 expect(dungeonCommandSchema.safeParse({...base,op:'next'}).success).toBe(true);
 for(const op of ['augment.choose','augment.reroll'])expect(dungeonCommandSchema.safeParse({...base,op}).success).toBe(false);
 expect(dungeonCommandSchema.safeParse({...base,op:'next',augment_id:'old-choice',offer_version:1}).success).toBe(false);
});
it('public member projection rejects removed run state while preserving ordinary dungeon fields',()=>{
 const member={id:'00000000-0000-4000-8000-000000000001',name:'policy-test',role:'adventurer',status:'active',ready:true,connected:true,joinedOrder:0,joinedStage:0,retainUntil:null,charged:false,quotaPeriod:null,completedAt:null,endReason:null,lastInputSeq:0,inputSeenAt:0,frozen:null,gains:{gold:0,xp:0,material:0,materials:{},books:{},gear:[],firstClear:false,unlocked:[]}};
 expect(dungeonViewSchema.shape.self.parse(member)).toEqual(member);
 expect(dungeonViewSchema.shape.self.safeParse({...member,augments:{chosen:[],offered:[]}}).success).toBe(false);
});

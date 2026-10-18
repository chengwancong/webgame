import {describe,it,expect} from 'vitest';
import {craftActionSchema,craftActionRequestSchema,fieldGatherRequestSchema} from '../packages/contracts/crafting.ts';
describe('制作命令契约',()=>{
 it('七种动作都可解析',()=>{
  for(const action of [{op:'craft',recipe:'wind-weapon'},{op:'refine',from:'wind_ore',times:1},{op:'exchange',to:'wind_ore',times:100},{op:'facility.upgrade',facility:'forge'},{op:'masterwork.apply',gear:'test'},{op:'masterwork.reroll',gear:'test',lockAffix:0},{op:'codex.claim',target:'wind'}])expect(craftActionSchema.safeParse(action).success).toBe(true);
 });
 it('拒绝越界数量和额外参数',()=>{
  for(const count of [0,-1,21,1.5])expect(craftActionSchema.safeParse({op:'craft',recipe:'test',count}).success).toBe(false);
  for(const times of [0,101,NaN])expect(craftActionSchema.safeParse({op:'refine',from:'wind_ore',times}).success).toBe(false);
  expect(craftActionSchema.safeParse({op:'craft',recipe:'test',seed:1}).success).toBe(false);
 });
 it('写命令必须带租约且采集必须显式声明模式',()=>{
  const request={command_id:crypto.randomUUID(),revision:0,region:'ss-map-wind',position:{x:2,y:3},action:{op:'craft',recipe:'test'}};
  expect(craftActionRequestSchema.safeParse(request).success).toBe(false);
  expect(craftActionRequestSchema.safeParse({...request,lease_id:crypto.randomUUID()}).success).toBe(true);
  const gather={command_id:request.command_id,revision:0,lease_id:crypto.randomUUID(),region:request.region,position:request.position,node:'node'};
  expect(fieldGatherRequestSchema.safeParse(gather).success).toBe(false);
  expect(fieldGatherRequestSchema.safeParse({...gather,mode:'route'}).success).toBe(true);
 });
});

import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {CharacterState} from '../packages/contracts/index.ts';
import {todayViewSchema,hubPortViewSchema,hubCommissionsViewSchema} from '../packages/contracts/hub.ts';
import {ensureProgression,talentPoints} from '../packages/rules/deep-progression.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {newHubState,hubDay,hubNextReset} from '../packages/rules/hub-state.ts';
import {claimHubPortTier,hubFleetLimit,hubAugmentRerolls,hubPortView,hubCommissionSlots} from '../packages/rules/hub-port.ts';
import {commandHubDock,hubDockView,hubDockTargetAllowed} from '../packages/rules/hub-dock.ts';
import {fillHubCommissions,countHubCommissionKill,commandHubCommission,refreshHubCommissions,hubCommissionPool,hubCommissionsView} from '../packages/rules/hub-commissions.ts';
import {enterHubPort,hubTodayView,hubReturnQueue,observeHubPortSession} from '../packages/rules/hub-today.ts';
import {setHubModePreference,hubModePreference} from '../packages/rules/hub-mode.ts';
import {recordHubOutsideActivity} from '../apps/api/src/hub-outside-service.ts';
import {ensureAppearance} from '../packages/rules/appearance.ts';
import {appearanceContent} from '../packages/content/appearance.ts';
import {buyHubRecipe,donateHubProgression,previewHubDonation} from '../packages/rules/hub-port-economy.ts';
import {progressionConfig} from '../packages/content/deep-progression.ts';
import {ensureChallengeProgress} from '../packages/rules/progression-challenges.ts';
import {challengeContent} from '../packages/content/progression-challenges.ts';

const epoch=Date.parse('2026-10-21T02:00:00Z'),hour=3600000;
function player():CharacterState{const s:CharacterState={id:randomUUID(),name:'港口测试',revision:1,build:1,level:50,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['ss-map-port'],bosses:[],safe:'ss-map-port',tasks:[]},starsea:newStarseaState()};ensureProgression(s);return s;}
function unlocked(){const h=newHubState(epoch);for(const id of ['wind-gate','mist-story-1','mist-nest-1','mist-gate'])h.chart.cleared[id]={firstAt:new Date(epoch).toISOString(),bestSeconds:60};h.chart.lastRegion='mist';return h;}
const rates={wind:{goldPerHour:2,materialsPerHour:{wind_ore:1,wind_herb:.5}},mist:{goldPerHour:3,materialsPerHour:{mist_ore:1.5,mist_herb:1}}};

describe('HUB B3 outside port',()=>{
 it('binds the first view after an actual arrival without double-release, and treats later logins/3-day return once',()=>{
  const h=unlocked();for(const id of ['first','second','third'])h.chart.returnQueue.push({id,item:{kind:'unlock',id,title:id,text:id}});
  enterHubPort(h,epoch);const visit=h.chart.returnSerial;observeHubPortSession(h,'hash-a',epoch+1);expect(h.chart.returnSerial).toBe(visit);h.chart.returnQueue.shift();
  for(let i=0;i<3;i++)observeHubPortSession(h,'hash-a',epoch+2+i);expect(h.chart.returnSerial).toBe(visit);expect(hubReturnQueue(h).filter(q=>q.kind==='unlock')).toHaveLength(0);
  observeHubPortSession(h,'hash-b',epoch+10);expect(h.chart.returnSerial).toBe(visit+1);expect(hubReturnQueue(h).filter(q=>q.kind==='unlock')).toHaveLength(1);
  observeHubPortSession(h,'hash-a',epoch+11);observeHubPortSession(h,'hash-b',epoch+12);expect(h.chart.returnSerial).toBe(visit+1);
  h.chart.returnQueue.shift();observeHubPortSession(h,'hash-b',epoch+10+3*86400000);expect(h.chart.returnSerial).toBe(visit+2);expect(hubReturnQueue(h).filter(q=>q.kind==='away')).toHaveLength(1);
  observeHubPortSession(h,'hash-b',epoch+10+3*86400000+1);expect(h.chart.returnSerial).toBe(visit+2);
 });
 it('uses configured donation bundles only, rejects pending/empty costs without mutation, and credits the existing reputation amount',()=>{
  const s=player(),h=unlocked();s.starsea!.location={map:'ss-map-port',x:0,y:0};h.chart.cleared['wind-story-1']={firstAt:new Date(epoch).toISOString(),bestSeconds:60};s.progression!.materials.wind_ore=12;
  const action={op:'reputation.donate' as const,target:'forge',value:'wind-bundle'},before=structuredClone({s,h});expect(()=>donateHubProgression(s,h,action)).toThrow('待 B4');expect({s,h}).toEqual(before);
  expect(()=>donateHubProgression(s,h,action,{donationOffers:{'wind-bundle':{materials:{},rep:25}}})).toThrow('待 B4');expect({s,h}).toEqual(before);
  const numbers={donationOffers:{'wind-bundle':{materials:{wind_ore:10},rep:progressionConfig.professionsRewards.donationRep}}};const preview=previewHubDonation(s,h,action,numbers);expect(preview.enabled).toBe(true);expect(preview.cost.items).toEqual({wind_ore:10});expect({s,h}).toEqual(before);const delta=donateHubProgression(s,h,action,numbers);expect(s.progression!.materials.wind_ore).toBe(2);expect(h.port.rep.forge).toBe(progressionConfig.professionsRewards.donationRep);expect(delta.progression?.materials.wind_ore).toBe(-10);
  const after=structuredClone({s,h});expect(()=>donateHubProgression(s,h,action,numbers)).toThrow('材料不足');expect({s,h}).toEqual(after);
 });
 it('requires an authored merchant tier and positive price, reuses existing recipe learning cost, and never charges twice',()=>{
  const s=player(),h=unlocked();s.starsea!.location={map:'ss-map-port',x:0,y:0};h.chart.cleared['wind-story-1']={firstAt:new Date(epoch).toISOString(),bestSeconds:60};s.gold=100;h.port.rep.forge=100;
  const before=structuredClone({s,h});expect(()=>buyHubRecipe(s,h,'wind-resist')).toThrow('待 B4');expect({s,h}).toEqual(before);
  expect(()=>buyHubRecipe(s,h,'wind-resist',{recipeOffers:{'wind-resist':{tier:1,gold:0,material:0}}})).toThrow('待 B4');expect({s,h}).toEqual(before);
  const result=buyHubRecipe(s,h,'wind-resist',{recipeOffers:{'wind-resist':{tier:1}}});expect(result.goldSpent).toBe(progressionConfig.costs.recipeLearn.gold);expect(s.progression!.recipes).toContain('wind-resist');
  const after=structuredClone({s,h});expect(()=>buyHubRecipe(s,h,'wind-resist',{recipeOffers:{'wind-resist':{tier:1}}})).toThrow('已经学会');expect({s,h}).toEqual(after);
 });
 it('grants all six regional cosmetics only on their corresponding node fact and preserves prior ownership',()=>{
  const s=player();s.progress.regions.push('forest','rift','tundra','abyss','dragonbone');ensureAppearance(s);expect(s.appearance!.unlocked).not.toContain('400106');
  s.starsea!.seen.push('hub-node:wind-gate');ensureAppearance(s);expect(s.appearance!.unlocked).toContain('400106');expect(s.appearance!.unlocked).not.toContain('400104');
  s.starsea!.seen.push('hub-node:mist-gate');ensureAppearance(s);expect(s.appearance!.unlocked).toContain('400104');s.starsea!.seen=[];ensureAppearance(s);expect(s.appearance!.unlocked).toContain('400104');
  expect(appearanceContent.bundles.filter(b=>b.unlock.type==='nodeFirstClear')).toHaveLength(6);
 });
 it('resets at exactly 05:00 UTC+8, independent of host timezone',()=>{
  expect(hubDay(Date.parse('2026-10-20T20:59:59.999Z'))).toBe('2026-10-20');expect(hubDay(Date.parse('2026-10-20T21:00:00Z'))).toBe('2026-10-21');
  expect(hubNextReset(Date.parse('2026-10-20T20:59:59.999Z'))).toBe('2026-10-20T21:00:00.000Z');expect(hubNextReset(epoch)).toBe('2026-10-21T21:00:00.000Z');
  const s=player(),h=unlocked();s.starsea!.features.push('high');ensureChallengeProgress(s).daily['high:2026-10-20']=challengeContent.limits.highDaily;
  expect(hubTodayView(s,h,Date.parse('2026-10-20T20:59:59.999Z')).high?.left).toBe(0);expect(hubTodayView(s,h,Date.parse('2026-10-20T21:00:00Z')).high?.left).toBe(challengeContent.limits.highDaily);
 });
 it('uses existing reputationClaims, rejects duplicate awards and caps all talent sources at 60',()=>{
  const s=player(),h=unlocked();expect(()=>claimHubPortTier(s,h,'shipyard',1)).toThrow('声望尚未达标');h.port.rep={forge:2500,shipyard:2500,post:2500};
  claimHubPortTier(s,h,'shipyard',1);expect(hubFleetLimit(s)).toBe(2);const before=structuredClone(s);expect(()=>claimHubPortTier(s,h,'shipyard',1)).toThrow('已经领取');expect(s).toEqual(before);
  claimHubPortTier(s,h,'shipyard',2);expect(hubAugmentRerolls(s)).toBe(1);claimHubPortTier(s,h,'shipyard',3);expect(hubFleetLimit(s)).toBe(3);
  for(const building of ['forge','shipyard','post'] as const)for(let tier=1;tier<=4;tier++)if(!s.progression!.reputationClaims.includes(`hub:${building}:${tier}`))claimHubPortTier(s,h,building,tier);
  expect(s.progression!.reputationClaims).toHaveLength(12);expect(talentPoints(s)).toBe(60);expect(hubCommissionSlots(s)).toBe(5);expect(s.gear.some(g=>g.quality==='rare')).toBe(true);expect(s.progression!.materials.summon_shard).toBe(20);
 });
 it('denies unopened dock, unearned fleet, uncleared region, deep and non-T1 material configuration',()=>{
  const s=player(),h=newHubState(epoch),before=structuredClone(h);expect(()=>commandHubDock(s,h,{op:'send',region:'wind'},rates,epoch)).toThrow('开放码头派遣');expect(h).toEqual(before);
  const open=unlocked();expect(()=>commandHubDock(s,open,{op:'send',fleet:2,region:'wind'},rates,epoch)).toThrow('船队尚未开放');expect(()=>commandHubDock(s,open,{op:'send',region:'deep'},rates,epoch)).toThrow('请先通关');
  expect(()=>commandHubDock(s,open,{op:'send',region:'wind'},{wind:{goldPerHour:1,materialsPerHour:{wind_boss:1}}},epoch)).toThrow('一阶采集材料');expect(open.dock.fleets).toEqual([]);
  delete open.chart.cleared['mist-gate'];expect(hubDockTargetAllowed(open,'mist')).toBe(true);open.chart.lastRegion='wind';expect(hubDockTargetAllowed(open,'mist')).toBe(false);
 });
 it('caps offline accrual at 12h, quick pays 2h once daily without consuming accrual, repeated collect cannot pay twice',()=>{
  const s=player(),h=unlocked();commandHubDock(s,h,{op:'send',region:'wind'},rates,epoch);
  expect(hubDockView(s,h,epoch+48*hour).fleets[0].accruedHours).toBe(12);
  const quick=commandHubDock(s,h,{op:'quick'},rates,epoch+48*hour);expect(quick).toEqual({gold:4,materials:{wind_ore:2,wind_herb:1}});expect(h.dock.fleets[0].accruedMs).toBe(12*hour);
  const before=structuredClone({s,h});expect(()=>commandHubDock(s,h,{op:'quick'},rates,epoch+48*hour)).toThrow('已领取');expect({s,h}).toEqual(before);
  expect(commandHubDock(s,h,{op:'collect'},rates,epoch+48*hour)).toEqual({gold:24,materials:{wind_ore:12,wind_herb:6}});expect(commandHubDock(s,h,{op:'collect'},rates,epoch+48*hour)).toEqual({gold:0,materials:{}});
 });
 it('preserves fractional accrual across frequent collection and settles previous route on destination change',()=>{
  const s=player(),h=unlocked();commandHubDock(s,h,{op:'send',region:'wind'},rates,epoch);
  for(let i=1;i<=4;i++)commandHubDock(s,h,{op:'collect'},rates,epoch+i*hour/4);expect(s.gold).toBe(2);expect(s.progression!.materials.wind_ore).toBe(1);
  const reward=commandHubDock(s,h,{op:'send',region:'mist'},rates,epoch+2*hour);expect(reward).toEqual({gold:2,materials:{wind_ore:1,wind_herb:1}});expect(h.dock.fleets[0].region).toBe('mist');
 });
 it('automatically fills four/five commissions, excludes graybox, counts only matching region/template/elite and deduplicates kill sources',()=>{
  const s=player(),h=unlocked();fillHubCommissions(s,h,epoch);expect(h.commissions.slots).toHaveLength(4);expect(hubCommissionPool().some(t=>t.id.startsWith('m0-'))).toBe(false);
  const row=hubCommissionPool().find(t=>t.id==='ow-wind-bounty-z1-1')!;h.commissions.slots[0]={id:'kill-test',task:row.id,region:'wind',progress:0,xp:0,sources:[]};
  const kill={source:'instance:kill:1',region:'mist' as const,elite:false,xp:20};countHubCommissionKill(h,kill);expect(h.commissions.slots[0].progress).toBe(0);
  countHubCommissionKill(h,{...kill,region:'wind'});countHubCommissionKill(h,{...kill,region:'wind'});expect(h.commissions.slots[0]).toMatchObject({progress:1,xp:20});
  s.progression!.reputationClaims.push('hub:post:2');fillHubCommissions(s,h,epoch);expect(h.commissions.slots).toHaveLength(5);
 });
 it('claims half confirmed kill XP and P55 row gold, refills immediately, rejects double claim and enforces 8/day',()=>{
  const s=player(),h=unlocked();fillHubCommissions(s,h,epoch);const row=hubCommissionPool().find(t=>t.id==='ow-wind-bounty-z1-1')!;
  h.commissions.slots[0]={id:'ready-test',task:row.id,region:'wind',progress:row.cond_count!,xp:201,sources:[]};const reward=commandHubCommission(s,h,{op:'claim',id:'ready-test'},8,epoch);expect(reward).toEqual({xp:101,gold:row.reward_gold,rep:8});expect(h.port.rep.post).toBe(8);expect(h.commissions.slots).toHaveLength(4);
  const before=structuredClone({s,h});expect(()=>commandHubCommission(s,h,{op:'claim',id:'ready-test'},8,epoch)).toThrow('领取或更换');expect({s,h}).toEqual(before);
  h.commissions.doneToday=8;const b=h.commissions.slots[0],r=hubCommissionPool().find(r=>r.id===b.task)!;b.progress=r.cond_count??1;expect(()=>commandHubCommission(s,h,{op:'claim',id:b.id},8,epoch)).toThrow('次数已用完');
  commandHubCommission(s,h,{op:'abandon',id:b.id},8,epoch);expect(h.commissions.slots).toHaveLength(4);expect(h.commissions.slots.some(v=>v.id===b.id)).toBe(false);
 });
 it('uses the same optional B4 commission correction in preview and claim without changing original bounty rows',()=>{
  const s=player(),h=unlocked();fillHubCommissions(s,h,epoch);const row=hubCommissionPool().find(t=>t.id==='ow-wind-bounty-z1-1')!,originalGold=row.reward_gold;
  h.commissions.slots[0]={id:'scaled-test',task:row.id,region:'wind',progress:row.cond_count!,xp:200,sources:[]};const policy={commissionGoldScale:.5,commissionXpShare:.25},quoted=hubCommissionsView(s,h,8,policy).slots.find(b=>b.id==='scaled-test')!.reward;
  expect(quoted).toEqual({xp:50,gold:Math.round(originalGold!*.5),rep:8});expect(commandHubCommission(s,h,{op:'claim',id:'scaled-test'},8,epoch,policy)).toEqual(quoted);expect(row.reward_gold).toBe(originalGold);
 });
 it('banks at most three days and resets only daily completion count, without expiring accepted progress',()=>{
  const s=player(),h=unlocked();fillHubCommissions(s,h,epoch);h.commissions.banked=3;h.commissions.doneToday=5;h.commissions.slots[0].progress=2;
  refreshHubCommissions(h,epoch+24*hour);expect(h.commissions).toMatchObject({banked:11,doneToday:0});refreshHubCommissions(h,epoch+10*24*hour);expect(h.commissions.banked).toBe(24);expect(h.commissions.slots[0].progress).toBe(2);
 });
 it('releases at most one unlock per port visit, keeps dialogue order, reports away only after 3 days and meets exact public schemas',()=>{
  const s=player(),h=unlocked();for(const id of ['one','two'])h.chart.returnQueue.push({id,item:{kind:'unlock',id,title:id,text:id}});h.chart.returnQueue.push({id:'dialogue',item:{kind:'dialogue',dialogueId:'ss-c01-t06'}});h.lastSeenAt=epoch-3*86400000;
  fillHubCommissions(s,h,epoch);enterHubPort(h,epoch);expect(hubReturnQueue(h).filter(q=>q.kind==='unlock')).toHaveLength(1);expect(hubReturnQueue(h).some(q=>q.kind==='away')).toBe(true);
  h.chart.returnQueue.shift();expect(hubReturnQueue(h).filter(q=>q.kind==='unlock')).toHaveLength(0);enterHubPort(h,epoch+1);expect(hubReturnQueue(h).filter(q=>q.kind==='unlock')).toHaveLength(1);expect(h.chart.returnQueue.filter(q=>q.item.kind==='away')).toHaveLength(1);
  expect(todayViewSchema.safeParse(hubTodayView(s,h,epoch)).success).toBe(true);expect(hubPortViewSchema.safeParse(hubPortView(s,h)).success).toBe(true);expect(hubCommissionsViewSchema.safeParse(hubCommissionsView(s,h)).success).toBe(true);
 });
 it('persists mode by character and leaves rewards zero until the derived B4 configuration is supplied',()=>{
  const h=unlocked(),other=newHubState(epoch);expect(hubModePreference(h)).toBe('semi');setHubModePreference(h,'auto');expect(hubModePreference(JSON.parse(JSON.stringify(h)))).toBe('auto');expect(hubModePreference(other)).toBe('semi');recordHubOutsideActivity(h,'craft');expect(h.port.rep.forge).toBe(0);
 });
});

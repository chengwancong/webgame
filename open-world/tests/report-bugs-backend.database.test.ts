import {afterAll,beforeAll,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {craftingDatabaseFixture} from './crafting-db-fixture.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {starseaBossMaps,starseaIslands} from '../packages/content/starsea/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {combatReviewSchema} from '../packages/contracts/combat-review.ts';
import {craftRecipes} from '../packages/content/crafting.ts';

const fixture=craftingDatabaseFixture('reportbugs');
beforeAll(async()=>fixture.start());afterAll(async()=>fixture.stop());
const counts=async(id:string)=>(await fixture.pool.query('SELECT (SELECT count(*)::int FROM ow_receipts WHERE character=$1) receipts,(SELECT count(*)::int FROM ow_ledger WHERE character=$1) ledger',[id])).rows[0];

it('weapon and forge previews return resolved responses, reject stale revisions, and do not write player progress',async()=>{
 const p=await fixture.player(),before=await p.saved(),startCounts=await counts(p.s.id),target=before.equipment.weapon!;
 const growth=await p.request('progression/preview',{revision:before.revision,action:{op:'weapon.level',target}});
 expect(growth.status).toBe(200);expect(growth.body.revision).toBe(before.revision);expect(typeof growth.body.enabled).toBe('boolean');expect(growth.body.cost.gold).toBeTypeOf('number');
 const {revision,region,position}=await p.command({op:'craft',recipe:'mist-weapon'});
 const preview=await p.request('crafting/preview',{revision,region,position,action:{op:'craft',recipe:'mist-weapon',tendency:'martial'}});
 expect(preview.status).toBe(200);expect(preview.body.enabled).toBe(false);expect(preview.body.reason).toContain('对应地城');expect(preview.body.output.name).toBeTruthy();expect(preview.body.output.name).not.toContain('岛款');
 const stale=await p.request('crafting/preview',{revision:revision+1,region,position,action:{op:'craft',recipe:'mist-weapon'}});expect(stale.status).toBe(409);expect(stale.body.code).toBe('REVISION');
 const retry=await p.request('crafting/preview',{revision,region,position,action:{op:'craft',recipe:'mist-weapon',tendency:'martial'}});expect(retry.body).toEqual(preview.body);
 expect(await p.saved()).toEqual(before);expect(await counts(p.s.id)).toEqual(startCounts);
});

it('combat advice responds for a legacy character, prioritizes an owned potion, and cannot write rewards',async()=>{
 const p=await fixture.player(),s=await p.saved();s.level=10;s.progress.regions=['meadow','ss-map-wind','ss-map-mist'];await p.save(s);
 const permit=await p.request('permit',{lease_id:p.lease,region:'meadow',attempt_id:randomUUID()});expect(permit.status).toBe(200);
 const old=await p.saved();delete old.progression;await p.save(old);
 const before=await p.saved(),startCounts=await counts(p.s.id);
 const fatal={enemy:'军需官',skill:'迷途雾幕',damage:9,damageType:'暗影',statuses:[],hint:'离开危险区域',kind:'zone'};
 const review=await p.request('combat/review',{permit:permit.body.id,fatal,recent:[]});expect(review.status).toBe(200);expect(combatReviewSchema.parse(review.body).gap).toContain('换抗性装备');
 expect(await p.saved()).toEqual(before);expect(await counts(p.s.id)).toEqual(startCounts);
 const withPotion=structuredClone(s),r=craftRecipes.find(r=>r.output.kind==='consumable'&&r.output.stat==='shadowResist')!;withPotion.progression!.consumables[r.output.id!]=1;await p.save(withPotion);
 const ownedBefore=await p.saved(),owned=await p.request('combat/review',{permit:permit.body.id,fatal,recent:[]});expect(owned.status).toBe(200);expect(owned.body.gap).toContain('背包已有');expect(await p.saved()).toEqual(ownedBefore);
});

it('authoritative snapshot recommends the next island boss instead of auto-tracking obsolete onboarding',async()=>{
 const p=await fixture.player(),s=await p.saved();s.level=17;s.lastRegion='ss-map-port';s.starsea=newStarseaState();s.starsea.prologue={done:true};s.starsea.islands=starseaIslands.slice(0,3);s.starsea.bosses=starseaBossMaps.slice(0,2);await p.save(s);
 const response=await p.request('character');expect(response.status).toBe(200);expect(response.body.starseaView.tracked).toBeNull();expect(response.body.starseaView.recommend).toMatchObject({kind:'stage',map:starseaIslands[2]});
 expect(response.body.starseaView.recommend.label).not.toContain('风栖');
});

it('gather rejects a remote visible decoration position without writing inventory or progress',async()=>{
 const p=await fixture.player(),s=await p.saved(),node=worldTables.objects.find(n=>n.kind==='gather'&&n.region==='ss-map-wind'&&!n.when&&!n.until)!;
 expect(node).toBeTruthy();s.lastRegion=node.region;s.field={region:node.region,gathered:[]};await p.save(s);
 const before=await p.saved(),startCounts=await counts(p.s.id);
 const response=await p.request('field/gather',{command_id:randomUUID(),revision:before.revision,lease_id:p.lease,region:node.region,node:node.id,mode:'manual',position:{x:node.x+20,y:node.y+20}});
 expect(response.status,JSON.stringify(response.body)).toBe(409);expect(response.body.code).toBe('GATHER_FAR');expect(await p.saved()).toEqual(before);expect(await counts(p.s.id)).toEqual(startCounts);
});

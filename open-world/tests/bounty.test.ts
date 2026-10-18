import {it,expect} from 'vitest';
import {acceptBounty,abandonBounty,bountyBoard,claimBounty,countBountyKill,bountyRows} from '../packages/rules/bounty.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {bountyHtml,bountyView} from '../apps/web/src/bounty-view.ts';
import type {Snapshot} from '../packages/contracts/index.ts';

const fail=(code:string)=>{throw Error(code);};
let n=0;const uuid=()=>'00000000-0000-4000-8000-'+String(++n).padStart(12,'0');
const z1camp=worldTables.camps.find(c=>c.zone==='m0-wind-z1')!,z2camp=worldTables.camps.find(c=>c.zone==='m0-wind-z2')!;

it('fills three distinct slots per zone and only counts accepted, matching zone kills',()=>{
 const st=newStarseaState(),board=bountyBoard(st,'m0-wind-z1',0,()=>0,uuid);
 expect(board).toHaveLength(3);expect(new Set(board.map(b=>b.task)).size).toBe(3);expect(bountyRows.every(r=>r.reward_xp===undefined)).toBe(true);
 const hounds=board.find(b=>b.task==='m0-wind-z1-b1')!,elite=board.find(b=>b.task==='m0-wind-z1-b2')!;
 const kill=(camp:string,elite=false)=>countBountyKill(st,{source:`${camp}:1:0`,template:'ss-mon-wind-hound',elite,xp:10});
 expect(kill(z1camp.id)).toEqual([]);acceptBounty(st,hounds.instance,5,fail);acceptBounty(st,elite.instance,5,fail);
 expect(kill(z2camp.id)).toEqual([]);expect(countBountyKill(st,{source:'q:task:1:0:0',template:'ss-mon-wind-hound',elite:true,xp:10})).toEqual([]);
 expect(kill(z1camp.id).map(b=>b.instance)).toEqual([hounds.instance]);
 expect(kill(z1camp.id,true).map(b=>b.instance).sort()).toEqual([hounds.instance,elite.instance].sort());
 expect(()=>claimBounty(st,hounds.instance,9,fail)).toThrow('BOUNTY_UNFINISHED');
 const {reward}=claimBounty(st,elite.instance,1000,fail);expect(reward).toEqual({xp:5,gold:60,material:6});
 expect(()=>claimBounty(st,elite.instance,1001,fail)).toThrow('BOUNTY_GONE');
 // Cooling slot keeps its instance until the cooldown ends, then redraws.
 expect(bountyBoard(st,'m0-wind-z1',1000+599999,()=>0,uuid).find(b=>b.slot===elite.slot)!.instance).toBe(elite.instance);
 expect(bountyBoard(st,'m0-wind-z1',1000+600000,()=>0,uuid).find(b=>b.slot===elite.slot)!.instance).not.toBe(elite.instance);
 abandonBounty(st,hounds.instance,fail);expect(st.bounties.find(b=>b.instance===hounds.instance)).toMatchObject({progress:0,xp:0});expect(st.bounties.find(b=>b.instance===hounds.instance)!.acceptedAt).toBeUndefined();
 const html=bountyHtml(bountyView({starsea:st} as unknown as Snapshot,'m0-wind-z1',1000)!,false);
 expect(html).toContain('接取');expect(html.match(/bounty-row/g)).toHaveLength(3);
});

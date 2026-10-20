import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
// @ts-expect-error Native audit utility has no TypeScript declarations.
import {receiptDigests,persistenceSummary,verifyPersistence} from '../tools/persistence-audit.mjs';
type Row=Record<string,any>;type Legacy={cluster:string,tables:Record<string,Row[]>,migrations:Row[]};
const uuid=(n:number)=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const legacyDigest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const receipt=(c:number,cmd:number,revision:number,state:Row)=>({character:uuid(c),command:uuid(cmd),fingerprint:'f'+cmd,receipt:{revision,snapshot:state}});
// Converts a full-row snapshot to the streamed form persistenceSnapshot returns, feeding receipts in primary-key order like the cursor does.
function streamed(s:Legacy){
 const acc=receiptDigests(),rows=[...s.tables.ow_receipts].sort((a,b)=>a.character<b.character?-1:a.character>b.character?1:a.command<b.command?-1:a.command>b.command?1:0);rows.forEach(r=>acc.add(r));
 const characters=new Map(s.tables.ow_characters.map(c=>[c.id,c])),heads=rows.filter(r=>characters.get(r.character)?.state.revision===r.receipt.revision);
 const {ow_receipts,...tables}=s.tables;return {cluster:s.cluster,tables,receipts:{...acc.done(),heads},migrations:s.migrations};
}
function world():Legacy{
 const state={revision:2,gold:5,taskJournal:[]};
 return {cluster:'1',migrations:[],tables:{ow_accounts:[{id:uuid(1),username:'a',password:'x'}],ow_characters:[{id:uuid(9),account:uuid(1),state}],
  ow_receipts:[receipt(9,30,2,{revision:2,gold:5}),receipt(9,20,1,{revision:1,gold:0})],ow_ledger:[{id:1,character:uuid(9),command:uuid(20)},{id:2,character:uuid(9),command:uuid(30)}]}};
}
function advanced(){const s=structuredClone(world());s.tables.ow_characters[0].state={revision:3,gold:7,taskJournal:[1]};s.tables.ow_receipts.push(receipt(9,10,3,{revision:3,gold:7}));s.tables.ow_ledger.push({id:3,character:uuid(9),command:uuid(10)});return s;}
it('audits the public starsea projection without hiding quest progress or legacy preference mismatches',()=>{
 const next=advanced();next.tables.ow_characters[0].state.starsea={tracked:'q1',trackedManually:false,done:['q0']};
 next.tables.ow_receipts[2].receipt.snapshot.starsea={tracked:'q1',done:['q0']};
 expect(verifyPersistence(streamed(world()),streamed(next))).toMatchObject({auditedCharacterChanges:1});
 const bad=structuredClone(next);bad.tables.ow_receipts[2].receipt.snapshot.starsea.done=[];
 expect(()=>verifyPersistence(streamed(world()),streamed(bad))).toThrow(/starsea/);
 const legacy=structuredClone(next);legacy.tables.ow_receipts[2].receipt.snapshot.starsea.trackedManually=true;
 expect(()=>verifyPersistence(streamed(world()),streamed(legacy))).toThrow(/starsea/);
});
it('streamed receipt summary equals the legacy full-row summary hash',()=>{
 const s=advanced();
 expect(persistenceSummary(streamed(s))).toEqual(persistenceSummary(s));
 expect(persistenceSummary(s).tables.ow_receipts.sha256).toBe(legacyDigest(s.tables.ow_receipts.map(r=>JSON.stringify(r)).sort()));
});
it('rejects receipts that do not arrive in JSON text order',()=>{
 const acc=receiptDigests();acc.add(receipt(9,30,1,{}));expect(()=>acc.add(receipt(9,20,1,{}))).toThrow(/JSON text order/);
});
it('accepts audited character changes across streamed and legacy snapshot forms',()=>{
 const expected={existingReceiptsPreserved:true,auditedCharacterChanges:1,newReceipts:1};
 for(const [before,after] of [[world(),advanced()],[streamed(world()),streamed(advanced())],[world(),streamed(advanced())],[streamed(world()),advanced()]])
  expect(verifyPersistence(before,after)).toMatchObject(expected);
 expect(verifyPersistence(streamed(world()),streamed(world()))).toMatchObject({auditedCharacterChanges:0,newReceipts:0});
});
it('still detects changed or missing receipts and unreceipted character changes',()=>{
 const changed=advanced();changed.tables.ow_receipts[1].fingerprint='tampered';
 expect(()=>verifyPersistence(streamed(world()),streamed(changed))).toThrow(/Lost or changed existing ow_receipts record/);
 const lost=advanced();lost.tables.ow_receipts.splice(0,1);
 expect(()=>verifyPersistence(world(),streamed(lost))).toThrow(/Lost or changed existing ow_receipts record/);
 const noReceipt=structuredClone(world());noReceipt.tables.ow_characters[0].state={revision:3,gold:9,taskJournal:[]};
 expect(()=>verifyPersistence(streamed(world()),streamed(noReceipt))).toThrow(/lacks a new command receipt/);
 const noLedger=advanced();noLedger.tables.ow_ledger.pop();
 expect(()=>verifyPersistence(streamed(world()),streamed(noLedger))).toThrow(/lacks ledger entry/);
 const mismatch=advanced();mismatch.tables.ow_receipts[2].receipt.snapshot.gold=8;
 expect(()=>verifyPersistence(streamed(world()),streamed(mismatch))).toThrow(/differs from committed receipt: gold/);
});

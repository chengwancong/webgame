import {expect,it} from 'vitest';
import {prepareSpinePlan,type SpineChange} from '../tools/spine/apply.ts';
import {spineSchemas} from '../tools/spine/schemas.ts';
import raw from '../packages/content/hex-runes.json';
import {hexD04Samples} from '../tools/fixtures/hex-d04-samples.ts';
const file='packages/content/hex-runes.json',sources=()=>({[file]:structuredClone(raw.slice(0,1))});
const plan=():SpineChange[]=>hexD04Samples.map((r,i)=>({file,op:'append',path:[i+1],before:null,after:structuredClone(r),basis:'Claude D04/D05 accepted sample; exact values, no retuning'}));
it('appends validated HEX identities without changing the original sample',()=>{
 const before=sources(),next=prepareSpinePlan(before,plan(),spineSchemas) as any;
 expect(next[file].map((r:any)=>r.id)).toEqual(['hex-chain-lightning','hex-aftershock','hex-detonation-sigil']);
 expect(next[file][0]).toEqual(before[file][0]);expect(before[file]).toHaveLength(1);
});
it('rejects append to any other numerical file and non-tail positions',()=>{
 const p=plan();expect(()=>prepareSpinePlan(sources(),[{...p[0],path:[0]}],spineSchemas)).toThrow();
 expect(()=>prepareSpinePlan(sources(),[{...p[0],path:[2]}],spineSchemas)).toThrow();
 expect(()=>prepareSpinePlan(sources(),[{...p[0],before:[]}],spineSchemas)).toThrow();
 expect(()=>prepareSpinePlan({'packages/content/aspects.json':[]},[{...p[0],file:'packages/content/aspects.json',path:[0]}],spineSchemas)).toThrow();
});
it('rejects mixed old-value edits, duplicate identities and invalid quality data',()=>{
 const p=plan(),edit:SpineChange={file,path:[0,'tiers','common','requiredLevel'],before:10,after:1,basis:'must not sneak retuning into addition'};
 expect(()=>prepareSpinePlan(sources(),[edit,...p],spineSchemas)).toThrow();
 expect(()=>prepareSpinePlan(sources(),[{...p[0],after:raw[0]}],spineSchemas)).toThrow();
 const bad:any=structuredClone(p[0]);delete bad.after.tiers.magic;
 expect(()=>prepareSpinePlan(sources(),[bad],spineSchemas)).toThrow();
});
it('retains the existing identity and before-value protections for subsequent numeric changes',()=>{
 const rename:SpineChange={file,path:[0,'id'],before:'hex-chain-lightning',after:'hex-renamed',basis:'must reject identity replacement'};
 expect(()=>prepareSpinePlan(sources(),[rename],spineSchemas)).toThrow();
 const stale:SpineChange={file,path:[0,'tiers','common','requiredLevel'],before:999,after:10,basis:'stale source'};
 expect(()=>prepareSpinePlan(sources(),[stale],spineSchemas)).toThrow();
});

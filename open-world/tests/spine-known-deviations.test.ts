import {it,expect,afterEach} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {versions} from '../packages/contracts/index.ts';
import {sha} from '../tools/spine/io.ts';
import {budgetKey,budgetDeviations,stabilityDeviations,compareKnownDeviations,readKnownDeviations} from '../tools/spine/known-deviations.ts';
const row=(id='a',error:number|null=.5,inBand=false)=>({id,category:'技能',group:'direct',error,inBand});
const original=[row('a'),row('unknown',null)];
const aggregate=[{key:'build/D1',error:.04}];
const baseline={budget:budgetDeviations(original),stability:stabilityDeviations(aggregate)};
it('accepts identical known deviations without pretending absolute targets passed',()=>{
 expect(compareKnownDeviations(baseline,original,aggregate)).toEqual({passed:true,regressions:[]});
 expect(budgetDeviations(original)).toHaveLength(2);expect(stabilityDeviations(aggregate)).toHaveLength(1);
});
it('accepts smaller magnitudes and resolved items still present in coverage',()=>{
 expect(compareKnownDeviations(baseline,[row('a',.3),row('unknown',0,true)],[{key:'build/D1',error:.01}]).passed).toBe(true);
});
it.each([.6,-.6])('rejects worse magnitude %s on either side of target',error=>{
 expect(compareKnownDeviations(baseline,[row('a',error),row('unknown',null)],aggregate).regressions[0].reason).toBe('worse');
});
it('rejects a new failing identity even when the old one is resolved and total counts stay equal',()=>{
 const result=compareKnownDeviations(baseline,[row('a',0,true),row('unknown',null),row('b',.2)],aggregate);
 expect(result.passed).toBe(false);expect(result.regressions).toContainEqual({kind:'budget',key:budgetKey(row('b')),reason:'new',baseline:null,current:.2});
});
it('does not count an unmeasured old failure as resolved',()=>{
 expect(compareKnownDeviations(baseline,[row('unknown',null)],[]).regressions.map(r=>r.reason)).toEqual(['missing','missing']);
});
it('fails numeric-to-unknown and unquantified-to-failing-numeric transitions for review',()=>{
 const result=compareKnownDeviations(baseline,[row('a',null),row('unknown',.9)],aggregate);
 expect(result.regressions.map(r=>r.reason)).toEqual(['unknown','unquantified-baseline']);
});
it('rejects new and worsening stability failures while leaving the 2% absolute criterion unchanged',()=>{
 const result=compareKnownDeviations(baseline,original,[{key:'build/D1',error:-.05},{key:'new/D1',error:.02}]);
 expect(result.regressions.map(r=>r.reason)).toEqual(['worse','new']);
 expect(stabilityDeviations([{key:'exact',error:.02}])).toHaveLength(1);
});
it('rejects duplicate identities and malformed budget records',()=>{
 expect(()=>compareKnownDeviations(baseline,[row(),row()],aggregate)).toThrow('Duplicate');
 expect(()=>compareKnownDeviations(baseline,original,[...aggregate,...aggregate])).toThrow('Duplicate');
 expect(()=>budgetDeviations([{...row(),inBand:undefined} as any])).toThrow('Invalid');
 expect(()=>budgetDeviations([{...row(),error:undefined} as any])).toThrow('Invalid');
 expect(()=>stabilityDeviations([{key:'broken',error:undefined} as any])).toThrow('Invalid');
});
const dirs:string[]=[];afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true});});
async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'aw-known-deviations-'));dirs.push(dir);
 const hashes={'packages/content/example.json':sha('content')};
 const known={schemaVersion:1,decision:'Explicit test acceptance',acceptedAt:new Date().toISOString(),acceptedVersions:versions,measurementVersions:{...versions,rules:'ow-76'},
  sourceHashesSha256:sha(JSON.stringify(hashes)),budgetReferenceSha256:sha('pointer'),auditSha256:sha('audit'),stabilitySha256:sha('stability'),...baseline};
 const path=join(dir,'known.json'),bytes=JSON.stringify(known);await writeFile(path,bytes);
 return {known,path,lock:{versions,hashes,knownDeviations:{path,sha256:sha(bytes)}}};
}
it('requires an explicitly pinned baseline and preserves measured versus accepted versions',async()=>{
 const f=await fixture();expect(await readKnownDeviations({hashes:{}})).toBeNull();
 expect((await readKnownDeviations(f.lock))?.measurementVersions.rules).toBe('ow-76');
});
it('fails closed if approved baseline bytes or source hashes change',async()=>{
 const f=await fixture();
 await expect(readKnownDeviations({...f.lock,hashes:{changed:sha('new')}})).rejects.toThrow('source hashes');
 await writeFile(f.path,'{}');await expect(readKnownDeviations(f.lock)).rejects.toThrow('hash');
});
it('fails closed if the baseline file disappears',async()=>{
 const f=await fixture();await rm(f.path);await expect(readKnownDeviations(f.lock)).rejects.toThrow();
});

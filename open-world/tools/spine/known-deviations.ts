import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {sha} from './io.ts';

const digest=z.string().regex(/^[a-f0-9]{64}$/);
const version=z.object({client:z.string(),protocol:z.number(),rules:z.string(),assets:z.string(),db:z.number()});
const deviation=z.object({key:z.string().min(1),magnitude:z.number().finite().nonnegative().nullable()}).strict();
export const knownDeviationsSchema=z.object({
 schemaVersion:z.literal(1),decision:z.string().min(1),acceptedAt:z.string(),
 acceptedVersions:version,measurementVersions:version,
 sourceHashesSha256:digest,budgetReferenceSha256:digest,auditSha256:digest,stabilitySha256:digest,
 budget:z.array(deviation),stability:z.array(deviation),
}).strict();
export type KnownDeviations=z.infer<typeof knownDeviationsSchema>;
type BudgetRow={id:string;category:string;group:string;inBand:boolean;error:number|null;observed?:number|null};
type StabilityRow={key:string;error:number|null};
export type Regression={kind:'budget'|'stability';key:string;reason:'new'|'worse'|'unknown'|'unquantified-baseline'|'missing';baseline:number|null;current:number|null};
export const budgetKey=(row:BudgetRow)=>JSON.stringify([row.category,row.id,row.group]);
const magnitude=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.abs(value):null;
function index<T>(rows:T[],key:(row:T)=>string){
 const map=new Map<string,T>();
 for(const row of rows){const id=key(row);if(map.has(id))throw Error('Duplicate measurement key: '+id);map.set(id,row);}
 return map;
}
export function budgetDeviations(rows:BudgetRow[]){
 index(rows,budgetKey);
 if(rows.some(r=>typeof r.id!=='string'||typeof r.category!=='string'||typeof r.group!=='string'||typeof r.inBand!=='boolean'||r.error!==null&&(typeof r.error!=='number'||!Number.isFinite(r.error))))throw Error('Invalid budget rows');
 return rows.filter(r=>!r.inBand).map(r=>({key:budgetKey(r),magnitude:magnitude(r.error)}));
}
export function stabilityDeviations(rows:StabilityRow[]){
 index(rows,r=>r.key);
 if(rows.some(r=>typeof r.key!=='string'||!r.key.length||r.error!==null&&(typeof r.error!=='number'||!Number.isFinite(r.error))))throw Error('Invalid stability rows');
 return rows.filter(r=>magnitude(r.error)===null||Math.abs(r.error!)>=.02).map(r=>({key:r.key,magnitude:magnitude(r.error)}));
}
/** Absolute goals remain unchanged. This is a separate, explicitly adopted regression gate. */
export function compareKnownDeviations(baseline:Pick<KnownDeviations,'budget'|'stability'>,budgetRows:BudgetRow[],stabilityRows:StabilityRow[]){
 const regressions:Regression[]=[];
 for(const [kind,known,current,coverage] of [
  ['budget',baseline.budget,budgetDeviations(budgetRows),new Set(budgetRows.map(budgetKey))],
  ['stability',baseline.stability,stabilityDeviations(stabilityRows),new Set(stabilityRows.map(r=>r.key))],
 ] as const){
  const before=index(known,r=>r.key);
  for(const row of known)if(!coverage.has(row.key))regressions.push({kind,key:row.key,reason:'missing',baseline:row.magnitude,current:null});
  for(const row of current){
   const previous=before.get(row.key);
   const reason=!previous?'new':previous.magnitude===null?row.magnitude===null?null:'unquantified-baseline'
    :row.magnitude===null?'unknown':row.magnitude>previous.magnitude+1e-12?'worse':null;
   if(reason)regressions.push({kind,key:row.key,reason,baseline:previous?.magnitude??null,current:row.magnitude});
  }
 }
 return {passed:regressions.length===0,regressions};
}
/** The source lock pins baseline bytes and the baseline pins the accepted source hashes.
 * Editing either side or refreezing new sources does not silently authorize new deviations. */
export async function readKnownDeviations(lock:any):Promise<KnownDeviations|null>{
 if(!lock.knownDeviations)return null;
 const ref=lock.knownDeviations;
 if(typeof ref.path!=='string'||typeof ref.sha256!=='string')throw Error('Invalid known-deviation reference');
 const bytes=await readFile(ref.path);
 if(sha(bytes)!==ref.sha256)throw Error('Known-deviation evidence hash does not match');
 const baseline=knownDeviationsSchema.parse(JSON.parse(bytes.toString('utf8')));
 if(sha(JSON.stringify(lock.hashes))!==baseline.sourceHashesSha256)throw Error('Known-deviation source hashes do not match');
 for(const key of ['client','protocol','rules','assets','db'] as const)if(lock.versions?.[key]!==baseline.acceptedVersions[key])throw Error('Known-deviation accepted version does not match');
 index(baseline.budget,r=>r.key);index(baseline.stability,r=>r.key);
 return baseline;
}

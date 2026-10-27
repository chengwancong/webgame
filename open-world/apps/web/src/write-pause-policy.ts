import type {Region} from '../../../packages/content/index.ts';

/** Only a safe-map arrival observation without a combat permit may finish in
 * the background. Command serialization, receipts and failures remain owned by
 * GameApp.write; this policy only decides whether that request pauses walking. */
export function backgroundArrivalWrite(path:string,body:object,changesBuild:boolean,region:Pick<Region,'id'|'rest'>,hasPermit:boolean):boolean{
 return path==='quest'&&!changesBuild&&!hasPermit
  &&(region.rest===true||region.id==='town'||region.id==='ss-map-port')
  &&typeof body==='object'&&body!==null&&!Array.isArray(body)&&Object.hasOwn(body,'op')
  &&(body as {op?:unknown}).op==='arrive';
}

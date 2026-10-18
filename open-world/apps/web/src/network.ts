import {validateResponse,type Snapshot,type Permit,type Receipt} from '../../../packages/contracts/index.ts';
export class ApiFailure extends Error{constructor(public code:string,message:string,public status:number){super(message);}}
export async function api<T>(path:string,body?:unknown,resumeLease?:string):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json',...(resumeLease?{'X-AW-Resume-Lease':resumeLease}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
 const v=await response.json();if(!response.ok)throw new ApiFailure(v.code,v.message,response.status);
 try{return validateResponse(path,v) as T;}catch(error){console.error('API response validation failed',path,error);throw new ApiFailure('PROTOCOL','服务器返回了不兼容的数据，请刷新页面后恢复连接。',409);}
 }catch(e){if(e instanceof ApiFailure)throw e;throw new ApiFailure('NETWORK','连接中断，请恢复连接后继续。',0);}finally{clearTimeout(timer);}
}
const OUTBOX='aw-open-world-outbox';
const outboxFailure=(message:string,cause:unknown)=>{const error=new ApiFailure('NETWORK',message,0);error.cause=cause;return error;};
export class Outbox {
 private db?:IDBDatabase;
 async init(){
  if(this.db)return;
  this.db=await new Promise((resolve,reject)=>{
   let settled=false;
   const timer=setTimeout(()=>{settled=true;reject(new ApiFailure('NETWORK','本机操作记录读取超时，请关闭重复游戏页面后恢复连接。',0));},10000);
   try{
    const request=indexedDB.open(OUTBOX,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('commands',{keyPath:'command_id'});
    request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;clearTimeout(timer);resolve(request.result);};
    request.onerror=()=>{settled=true;clearTimeout(timer);reject(outboxFailure('本机操作记录读取失败，请恢复连接后重试。',request.error));};
   }catch(error){settled=true;clearTimeout(timer);reject(outboxFailure('本机操作记录未能打开，请恢复连接后重试。',error));}
  });
 }
 async put(body:any,character_id:string,path='combat/report'){return this.tx('readwrite',s=>s.put({command_id:body.command_id,character_id,body,path}));}
 async reject(body:any,character_id:string,path:string,reason:string){return this.tx('readwrite',s=>s.put({command_id:body.command_id,character_id,body,path,rejected:{reason,at:new Date().toISOString()}}));}
 async remove(id:string){return this.tx('readwrite',s=>s.delete(id));}
 async all(character_id:string):Promise<{body:any;path:string}[]>{
  if(!this.db)return [];
  return this.transaction('readonly',(store,accept)=>{const request=store.getAll();request.onsuccess=()=>accept(request.result.filter((v:any)=>v.character_id===character_id&&!v.rejected).map((v:any)=>({body:v.body,path:v.path??'combat/report'})));});
 }
 private tx(mode:IDBTransactionMode,fn:(s:IDBObjectStore)=>void){return this.transaction<void>(mode,(store,accept)=>{fn(store);accept(undefined);});}
 /** Completion belongs to the IDB transaction, including abort/error paths and open failures. */
 private transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore,accept:(value:T)=>void)=>void):Promise<T>{
  if(!this.db)return Promise.reject(new ApiFailure('NETWORK','本机操作记录未就绪，请恢复连接后重试。',0));
  return new Promise<T>((resolve,reject)=>{
   let tx:IDBTransaction|undefined,value:T;
   const verb=mode==='readonly'?'读取':'保存';
   const timer=setTimeout(()=>{try{tx?.abort();}catch{}reject(new ApiFailure('NETWORK',`本机操作记录${verb}超时，请恢复连接后重试。`,0));},10000);
   const fail=(cause:unknown)=>{clearTimeout(timer);reject(outboxFailure(`本机操作记录${verb}失败，请恢复连接后重试。`,cause));};
   try{
    tx=this.db!.transaction('commands',mode);
    tx.oncomplete=()=>{clearTimeout(timer);resolve(value);};
    tx.onerror=tx.onabort=()=>fail(tx!.error);
    run(tx.objectStore('commands'),next=>{value=next;});
   }catch(error){clearTimeout(timer);try{tx?.abort();}catch{}fail(error);}
  });
 }
}
export type {Snapshot,Permit,Receipt};

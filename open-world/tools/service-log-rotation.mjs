import {openSync,closeSync,statSync,copyFileSync,ftruncateSync} from 'node:fs';
/** Windows append-only descriptors cannot truncate; writers keep their append handles. */
export function rotateServiceLog(path,maxBytes=8*1024*1024){
 if(statSync(path).size<=maxBytes)return false;
 copyFileSync(path,path+'.previous');
 const writable=openSync(path,'r+');
 try{ftruncateSync(writable,0);}finally{closeSync(writable);}
 return true;
}

import fs from 'node:fs/promises';
/** Windows file watchers can briefly deny replace; keep the old valid manifest until rename succeeds. */
export async function writePixelManifest(file,value,{allowInPlace=false}={}){
 const temporary=file+'.'+process.pid+'.tmp';await fs.writeFile(temporary,JSON.stringify(value,null,2)+'\n');
 for(let attempt=0;;attempt++){try{await fs.rename(temporary,file);return;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;if(attempt>=7){if(!allowInPlace)throw error;const old=await fs.readFile(file);JSON.parse(old);try{await fs.writeFile(file,JSON.stringify(value,null,2)+'\n');JSON.parse(await fs.readFile(file,'utf8'));}catch(writeError){await fs.writeFile(file,old);throw writeError;}await fs.unlink(temporary);return;}await new Promise(resolve=>setTimeout(resolve,Math.min(600,25*2**attempt)));}}
}

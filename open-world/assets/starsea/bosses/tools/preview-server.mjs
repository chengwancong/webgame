import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=resolve(fileURLToPath(new URL('../../../..',import.meta.url)));
const publicRoot=resolve(root,'apps/web/public');
export async function startPreviewServer(port=0){
 const server=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   let file;
   if(pathname==='/spine-webgl.js')file=resolve(root,'node_modules/@esotericsoftware/spine-webgl/dist/iife/spine-webgl.js');
   else file=resolve(publicRoot,'.'+pathname);
   if(!file.startsWith(publicRoot)&&pathname!=='/spine-webgl.js')throw Error('outside public');
   const body=await readFile(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.atlas':'text/plain','.webm':'video/webm','.svg':'image/svg+xml'}[extname(file)]??'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(body);
  }catch(error){res.writeHead(404);res.end(String(error.message));}
 });
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 return {server,origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>server.close(r))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const live=await startPreviewServer(Number(process.argv[2]??8634));console.log(live.origin+'/art/starsea/bosses/preview.html');
}

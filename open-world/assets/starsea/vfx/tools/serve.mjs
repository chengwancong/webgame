import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(import.meta.dirname,'../../../..'),publicRoot=resolve(root,'apps/web/public');
export async function serve(port=0){const server=createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(publicRoot,'.'+pathname);
 if(!file.startsWith(publicRoot+sep))throw Error('outside public');
 const raw=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.atlas':'text/plain','.webm':'video/webm'}[extname(file)]??'application/octet-stream'),'Cache-Control':'no-store'});res.end(raw);
 }catch(e){res.writeHead(404);res.end(String(e));}});await new Promise(r=>server.listen(port,'127.0.0.1',r));return {server,origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>server.close(r))};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const s=await serve(Number(process.argv[2]??8637));console.log(s.origin+'/art/starsea/vfx/preview.html');}

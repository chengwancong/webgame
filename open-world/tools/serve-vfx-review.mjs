import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('.runtime/vfx-review-build'),capture=resolve('../docs/reviews/open-world/vfx-v2-20261001');await mkdir(capture,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname.startsWith('/__capture/')){
  const name=url.pathname.slice('/__capture/'.length);if(!/^(vfx-acceptance\.json|vfx-(before|after)-(normal|slow)\.webm)$/.test(name)){res.writeHead(400);res.end();return;}
  const path=resolve(capture,name);if(req.method==='POST'){if(req.headers.origin!=='http://127.0.0.1:'+server.address().port){res.writeHead(403);res.end();return;}const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>128*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}await writeFile(path,Buffer.concat(chunks));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true,path,bytes}));return;}
  res.setHeader('Content-Type',name.endsWith('.webm')?'video/webm':'application/json');res.end(await readFile(path));return;
 }
 const name=decodeURIComponent(url.pathname==='/'?'/combat-art-qa.html':url.pathname),path=resolve(root,'.'+name);
 if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[extname(path)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);
}catch{res.writeHead(404);res.end('Not found');}});
server.listen(0,'127.0.0.1',()=>console.log('VFX snapshot pid '+process.pid+': http://127.0.0.1:'+server.address().port+'/combat-art-qa.html'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit()));

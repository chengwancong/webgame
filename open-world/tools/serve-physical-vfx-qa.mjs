// Isolated, visible-browser gallery. No API proxy, login or production-service control.
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'docs/reviews/physical-vfx-20261011');
const server=await createServer({configFile:false,root:resolve(root,'apps/web'),server:{host:'127.0.0.1',port:8768,strictPort:true,fs:{allow:[root]}},plugins:[{name:'physical-evidence',configureServer(s){s.middlewares.use(async(req,res,next)=>{
 if(req.url?.startsWith('/api/')){res.statusCode=403;res.end('Gallery has no API');return;}
 if(req.method!=='POST'||!req.url?.startsWith('/__physical_capture/'))return next();
 const path=decodeURIComponent(req.url.split('?')[0].slice('/__physical_capture/'.length));
 if(!/^(before|after|after-samples|metrics)\/[a-z0-9_.-]+\.(png|json)$/.test(path)){res.statusCode=400;res.end('Invalid evidence path');return;}
 try{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>32*1024*1024)throw Error('Capture too large');chunks.push(c);}const file=resolve(out,path);await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,Buffer.concat(chunks));res.setHeader('content-type','application/json');res.end(JSON.stringify({saved:path}));}catch(e){res.statusCode=500;res.end(String(e));}
 });}}]});
await server.listen();console.log('VISIBLE gallery: http://127.0.0.1:8768/combat-art-qa.html');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});

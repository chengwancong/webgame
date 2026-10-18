// Isolated, visible-browser motion lab. No API proxy, login or production-service control.
// POST /__review/<name>.png saves a review sheet to .qa/review-sheets/ (local only, never committed).
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'.qa/review-sheets');
const server=await createServer({configFile:false,root:resolve(root,'apps/web'),server:{host:'127.0.0.1',port:8769,strictPort:true,fs:{allow:[root]}},plugins:[{name:'no-api',configureServer(s){s.middlewares.use(async(req,res,next)=>{
 if(req.url?.startsWith('/api/')){res.statusCode=403;res.end('Lab has no API');return;}
 if(req.method!=='POST'||!req.url?.startsWith('/__review/'))return next();
 const name=decodeURIComponent(req.url.split('?')[0].slice('/__review/'.length));
 if(!/^[a-z0-9_.-]+\.(png|json)$/.test(name)){res.statusCode=400;res.end('Invalid review name');return;}
 try{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>48*1024*1024)throw Error('Sheet too large');chunks.push(c);}await mkdir(out,{recursive:true});await writeFile(resolve(out,name),Buffer.concat(chunks));res.setHeader('content-type','application/json');res.end(JSON.stringify({saved:name}));}catch(e){res.statusCode=500;res.end(String(e));}
});}}]});
await server.listen();console.log('VISIBLE lab: http://127.0.0.1:8769/skill-motion-lab.html');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});

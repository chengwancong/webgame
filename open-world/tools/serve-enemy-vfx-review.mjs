import {createServer} from 'vite';
import {resolve} from 'node:path';
import {mkdir,writeFile,rename,readFile} from 'node:fs/promises';
const capture=resolve(process.env.AW_VFX_CAPTURE_DIR??'../docs/reviews/open-world/enemy-vfx-20261002');await mkdir(capture,{recursive:true});
const server=await createServer({configFile:'apps/web/vite.config.ts',server:{port:0,strictPort:false,host:'127.0.0.1',watch:null,hmr:false},plugins:[{name:'enemy-vfx-capture',configureServer(vite){vite.middlewares.use('/__capture',async(req,res)=>{try{
 const name=(req.url??'').replace(/^\//,'');if(!/^(before-normal|after-normal|after-slow)\.webm$/.test(name)){res.writeHead(400);res.end();return;}
 const destination=resolve(capture,name);if(req.method==='POST'){
  if(req.headers.origin!=='http://127.0.0.1:'+vite.httpServer.address().port){res.writeHead(403);res.end();return;}
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>64*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  await writeFile(destination+'.part',Buffer.concat(chunks));await rename(destination+'.part',destination);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true,name,bytes}));
 }else if(req.method==='GET'){res.setHeader('Content-Type','video/webm');res.end(await readFile(destination));}else{res.writeHead(405);res.end();}
 }catch{res.writeHead(500);res.end();}});}}]});
await server.listen();console.log(JSON.stringify({url:'http://127.0.0.1:'+server.httpServer.address().port+'/monster-vfx-qa.html',capture}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit();});

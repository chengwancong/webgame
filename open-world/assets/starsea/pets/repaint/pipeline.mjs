import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import sharp from 'sharp';
export {sharp};
export const group=dirname(fileURLToPath(import.meta.url)),root=resolve(group,'../../../..'),publicRoot=join(root,'apps/web/public'),out=join(publicRoot,'art/starsea/pets/repaint');
export const library='G:/webgame/abyss-walker-migration/spine源文件_召唤与合成Q版spine动画源文件欧美风格小怪物素材819套';
export const families=['A3','A7','A13','A15','B6','C4','C7','C8','D1','D3','S1','S2','S5','S6','S7','S9','S12'];
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const rel=p=>p.replaceAll('\\','/').replace(root.replaceAll('\\','/')+'/','');
export async function json(p,v){await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(v,null,2)+'\n');}
export async function record(p){const b=await readFile(p);return {path:rel(p),sha256:sha(b),bytes:b.length,...(extname(p)==='.png'?((m)=>({width:m.width,height:m.height,alpha:m.hasAlpha}))(await sharp(b).metadata()):{})};}
export async function boot(){
 await mkdir(join(group,'evidence'),{recursive:true});await mkdir(out,{recursive:true});
 const server=createServer(async(req,res)=>{try{
  const u=decodeURIComponent(req.url.split('?')[0]);let file;
  if(u==='/render'){res.setHeader('Content-Type','text/html');res.end('<title>PA2 · Spine 3.6 · hardware export</title><style>body{background:#f3efe5;color:#293940;font:16px sans-serif}canvas{border:1px solid #aaa}</style><p>PA2 串行原生骨骼渲染</p><canvas width="512" height="512"></canvas><script src="/spine.js"></script><script src="/renderer.js"></script>');return;}
  if(u==='/spine.js')file=join(root,'tools/vendor/spine36/spine-webgl.js');
  else if(u==='/renderer.js')file=join(group,'renderer.js');
  else if(u.startsWith('/library/'))file=join(library,u.slice(9));
  else if(u.startsWith('/group/'))file=join(group,u.slice(7));
  else file=join(publicRoot,u.slice(1));
  const allowed=[root,resolve(library)].some(p=>resolve(file).startsWith(p+ '\\'));if(!allowed)throw Error('outside allowed roots');
  res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.json':'application/json','.png':'image/png','.ttf':'font/ttf'})[extname(file)]??'text/plain');res.end(await readFile(file));
 }catch(e){res.statusCode=404;res.end(String(e));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-gl=angle','--use-angle=d3d11','--enable-webgl','--disable-background-timer-throttling'],downloadsPath:join(group,'evidence')});
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});page.on('pageerror',e=>console.error('PAGE',e.message));
 return {base,browser,page,async close(){await browser.close();await new Promise(r=>server.close(r));}};
}
export async function load(ctx,family,stage,options={}){
 const name='guai'+family+stage,dir=join(library,name),source=JSON.parse(await readFile(join(dir,name+'.json'),'utf8'));
 if(!source.skeleton.spine.startsWith('3.6.'))throw Error('Wrong Spine '+name);
 await ctx.page.goto(ctx.base+'/render');
 const info=await ctx.page.evaluate(async({name,options})=>await window.petLoad(name,options),{name,options});
 return {...info,name,source,dir};
}
export const render=(ctx,action,time,camera)=>ctx.page.evaluate(({action,time,camera})=>window.petRender(action,time,camera),{action,time,camera});
export async function pixels(buffer){const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1,n=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>3){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);n++;}return {x:l,y:t,w:r-l+1,h:b-t+1,count:n};}

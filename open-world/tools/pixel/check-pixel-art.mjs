import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const point=(p,w,h)=>Array.isArray(p)&&p.length===2&&p.every(Number.isInteger)&&p[0]>=0&&p[1]>=0&&p[0]<w&&p[1]<h;
export async function checkAsset(asset,{publicRoot=path.join(root,'apps/web/public'),palette=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/pixel-palette.json'),'utf8')),candidateRoot,candidateFiles}={}){
 const issues=[],[fw,fh]=asset.frame??[],allowed=new Set(Object.values(palette.ramps).flat().map(c=>c.slice(1).toLowerCase()));
 const add=(code,detail)=>issues.push({code,detail});
 if(!(fw>0&&fh>0&&Number.isInteger(fw)&&Number.isInteger(fh)))return [{code:'grid',detail:'Invalid native frame size'}];
 if(!point(asset.anchor,fw+1,fh+1))add('anchor','Missing or out-of-bounds integer foot anchor');
 if(asset.scale!==2)add('scale','Native art must be displayed at x2');
 if(!['authored-pixels','adapted-pixels'].includes(asset.provenance?.method)||!asset.provenance.reviewed||!asset.provenance.recipe)add('provenance','Authored pixel cleanup review missing');
 if(asset.provenance?.method==='adapted-pixels'){const u=asset.provenance.upstream;if(u?.license!=='CC0-1.0'||!/^https:\/\//.test(u?.url??'')||!/^[0-9a-f]{64}$/.test(u?.sourceSha256??'')||!u?.author||!u?.file||!u?.package||!/^[0-9a-f]{64}$/.test(u?.archiveSha256??'')||!Array.isArray(u?.modifications))add('license','Adapted pixel art requires a pinned CC0 source and author');}
 if(!asset.file?.startsWith('/art-pixel/')||asset.file.includes('..'))return [...issues,{code:'file',detail:'Unsafe or non-pixel path'}];
 const file=path.join(candidateRoot&&candidateFiles?.has(asset.file)?candidateRoot:publicRoot,asset.file);
 if(!fs.existsSync(file))return [...issues,{code:'file',detail:'Missing image '+asset.file}];
 const bytes=fs.readFileSync(file),hash=createHash('sha256').update(bytes).digest('hex');if(hash!==asset.sha256)add('hash','Image changed after manifest approval');
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info;
 if(w%fw||h%fh)add('grid',`${w}x${h} does not contain whole ${fw}x${fh} frames`);
 let outside=0,alpha=0,isolated=0,opaque=0;const occupiedFrames=new Set();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,a=data[i+3];if(!a)continue;opaque++;occupiedFrames.add(`${Math.floor(x/fw)},${Math.floor(y/fh)}`);
  const rgb=data.subarray(i,i+3).toString('hex');if(!allowed.has(rgb))outside++;
  if(a!==255&&!(asset.kind==='image'&&asset.shadow===true&&a===128&&rgb===palette.shadow.slice(1)))alpha++;
  let neighbor=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
   if(nx<0||ny<0||nx>=w||ny>=h||Math.floor(nx/fw)!==Math.floor(x/fw)||Math.floor(ny/fh)!==Math.floor(y/fh))continue;
   if(data[(ny*w+nx)*4+3])neighbor=true;
  }if(!neighbor)isolated++;
 }
 if(!opaque)add('empty','No visible pixels');
 if(outside)add('palette',`${outside} pixels outside master palette`);if(alpha)add('alpha',`${alpha} illegal alpha values`);if(isolated)add('isolated',`${isolated} disconnected single pixels`);
 if(asset.kind==='actor'){
  if(!asset.actions||!Object.keys(asset.actions).length)add('animation','No authored actions');
  for(const [name,a] of Object.entries(asset.actions??{})){
   if(!Number.isInteger(a.row)||a.row<0||(a.row+1)*fh>h||!Number.isInteger(a.count)||a.count<1||a.count*fw>w)add('grid',name+': frames outside sheet');
   if(!(a.duration>0&&Number.isFinite(a.duration))||!(a.impactTime>=0&&a.impactTime<=a.duration))add('timing',name+': invalid timing');
   if(a.frameTimes?.length!==a.count||a.frameTimes[0]!==0||a.frameTimes.some((t,i)=>!Number.isFinite(t)||t<0||t>=a.duration||(i>0&&t<=a.frameTimes[i-1])))add('timing',name+': invalid frame boundaries');
   if(!Number.isInteger(a.impactFrame)||a.impactFrame<0||a.impactFrame>=a.count||Math.abs(a.frameTimes?.[a.impactFrame]-a.impactTime)>1e-6)add('impact',name+': impact frame does not start at source impact time');
   if(a.sockets?.length!==a.count)add('socket',name+': missing per-frame sockets');
   for(let n=0;n<a.count;n++)if(!occupiedFrames.has(`${n},${a.row}`))add('empty',`${name}[${n}] is blank`);
   for(let n=0;n<a.count;n++)for(const key of ['feet','chest','hand','weapon','muzzle'])if(!point(a.sockets?.[n]?.[key],fw,fh))add('socket',`${name}[${n}].${key} missing or invalid`);
  }
 }
 return issues;
}
export async function checkManifest(manifest,options={}){
 const issues=[],keys=Object.keys(manifest.assets??{});
 const palette=options.palette??JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/pixel-palette.json'),'utf8')),colors=Object.values(palette.ramps).flat();
 if(colors.length>64||new Set(colors).size!==colors.length)issues.push({key:'palette',code:'palette',detail:'Master palette must have at most 64 unique colors'});
 if(manifest.schemaVersion!==1||JSON.stringify(manifest.canvas)!=='[640,360]'||JSON.stringify(manifest.stage)!=='[1280,720]')issues.push({key:'manifest',code:'schema',detail:'Wrong canvas contract'});
 if(!keys.length&&!options.allowEmpty)issues.push({key:'manifest',code:'coverage',detail:'No approved pixel art'});
 for(const key of keys){
  const asset=manifest.assets[key];
  for(const layer of asset.layers??[]){const target=manifest.assets[layer];if(!target||target.scale!==2||JSON.stringify(target.frame)!==JSON.stringify(asset.frame))issues.push({key,code:'layer',detail:'Missing or mismatched authored layer '+layer});}
  for(const issue of await checkAsset(asset,{...options,palette}))issues.push({key,...issue});
 }
 for(const [key,set] of Object.entries(manifest.appearances??{})){
  if(set.overlay&&!manifest.assets[set.overlay])issues.push({key,code:'layer',detail:'Missing outfit overlay'});
  if([...set.cloth,...set.hair].some(c=>!colors.includes(c)))issues.push({key,code:'palette',detail:'Outfit ramp leaves the master palette'});
 }
 return {assets:keys.length,issues,ok:issues.length===0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const flag=process.argv.indexOf('--manifest'),file=flag>=0?process.argv[flag+1]:path.join(root,'apps/web/public/art-pixel/manifest.json');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8')),report=await checkManifest(manifest,{allowEmpty:process.argv.includes('--allow-empty')});
 console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;
}

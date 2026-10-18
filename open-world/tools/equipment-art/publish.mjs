// Register a complete reviewed equipment art package without creating gameplay items.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,arg,index,list)=>arg.startsWith('--')?[...pairs,[arg.slice(2),list[index+1]]]:pairs,[]));
if(!args.package||!args.review)throw Error('Usage: node tools/equipment-art/publish.mjs --package PACKAGE/manifest.json --review visual-review.json');
const packagePath=resolve(args.package),base=dirname(packagePath),packBytes=await readFile(packagePath),pack=JSON.parse(packBytes),review=JSON.parse(await readFile(resolve(args.review),'utf8'));
if(review.packageSha256!==createHash('sha256').update(packBytes).digest('hex'))throw Error('Visual review belongs to a different package revision');
if(review.status!=='approved'||review.iconCount!==324||review.setCount!==54)throw Error('Expected review approval for all 54 sets / 324 icons');
const items=pack.items;
if(items?.length!==324||new Set(items.map(i=>i.id)).size!==324||new Set(items.map(i=>i.setId)).size!==54)throw Error('Incomplete equipment art package');
const sourceRoot=resolve('assets/ui-source/v2'),folder=join(sourceRoot,'equipment-handdrawn');await mkdir(folder,{recursive:true});
const records=[];
for(const item of items){
 const bytes=await readFile(resolve(base,item.file)),sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==item.production?.sha256)throw Error('Production image changed after review: '+item.id);
 const file=`equipment-handdrawn/${item.id}.png`;await copyFile(resolve(base,item.file),resolve(sourceRoot,file));
 records.push({id:item.id,setId:item.setId,name:item.name,direction:item.direction,series:item.series,tier:Number(String(item.tier).replace(/^T/,'')),slot:item.slot,file,path:'/art/ui-v2/'+file,size:[256,256],sha256});
}
if(new Set(records.map(i=>i.sha256)).size!==324)throw Error('Duplicate equipment artwork');
const sourcePath=join(sourceRoot,'ui-source.json'),source=JSON.parse(await readFile(sourcePath,'utf8')),ids=new Set(records.map(i=>i.id));
source.assets=source.assets.filter(i=>!ids.has(i.id));source.assets.push(...records.map(({id,file,size})=>({id,kind:'gear',file,size})));source.version??='2.4';
await writeFile(sourcePath,JSON.stringify(source,null,2)+'\n');
await writeFile(join(folder,'catalog.json'),JSON.stringify({schemaVersion:1,purpose:'equipment-art-library',gameplayItemsCreated:false,iconCount:324,setCount:54,slots:['weapon','armor','helmet','boots','necklace','ring'],directions:['sword','hammer','axe','staff','hidden','wand'],series:['standard','omega','primal'],tiers:[1,2,3],items:records},null,2)+'\n');
console.log(JSON.stringify({registered:records.length,sets:54,sourceManifest:sourcePath,catalog:join(folder,'catalog.json')}));

import assert from 'node:assert/strict';
import {openWorldRuntimeAssets} from '../packages/asset-manifest/open-world-assets.ts';
import grey from '../packages/asset-manifest/open-world-planes-greybox.v1.json';
import art from '../packages/asset-manifest/open-world-planes.v1.json';
import {generatePlaneStage} from '../packages/content/plane-layouts.ts';
let changed=0;
for(const g of grey.assets){
 const a=art.assets.find(a=>a.id===g.id);
 const runtime=openWorldRuntimeAssets.find(a=>a.id===g.id)!.runtime;
 const replaced=a?.runtime.registration==='greybox-contract-exact';
 assert.equal(runtime.file,replaced?a.runtime.file:g.runtime.file,g.id+' 文件解析');
 assert.deepEqual(runtime.anchor,g.contract.anchor,g.id+' 锚点');
 assert.equal(runtime.displayWidth,g.contract.displayWidth,g.id+' 显示宽');
 assert.equal(runtime.width,g.contract.canvas[0]);assert.equal(runtime.height,g.contract.canvas[1]);
 if(replaced)changed++;
}
assert.equal(changed,19);
console.log(JSON.stringify({passed:true,replaced:changed,unchanged:grey.assets.length-changed}));

// 随机场地复核四侧摆放；不把仅面向镜头两侧挂灯的现行规则误作四向灯图。
const seeds=process.argv.slice(2).map(Number);
if(!seeds.length)seeds.push(...Array.from({length:12},(_,i)=>1+i*104729));
assert.ok(seeds.every(s=>Number.isSafeInteger(s)&&s>0),'种子必须为正整数');
const directions=[['+x',1,0],['-x',-1,0],['+y',0,1],['-y',0,-1]] as const;
for(const kit of ['cave','crypt','maze'] as const){
 const walls=new Set<string>(),ledges=new Set<string>(),blockerWalls=new Set<string>(),lights=new Set<string>(),mirror=new Set<boolean>(),parts=new Set<string>();
 for(const seed of seeds)for(const stage of [1,2]){
  const {map}=generatePlaneStage(`plane-wind-nest-${kit}-${stage}`,seed),n=map.width;
  const cell=(x:number,y:number)=>x<0||y<0||x>=n||y>=map.height?'#':map.cells[y*n+x];
  for(let y=0;y<map.height;y++)for(let x=0;x<n;x++)if(cell(x,y)==='#')for(const [d,dx,dy] of directions)if('.,'.includes(cell(x+dx,y+dy)))walls.add(d);
  for(const p of map.pieces){
   const id=`ow-art-plane-${kit}-${p.part}`,a=openWorldRuntimeAssets.find(a=>a.id===id);
   assert.ok(a?.runtime.file,id+' 随机摆放缺图');parts.add(p.part);
   if(p.layer==='prop'){
    const fx=p.x%1,fy=p.y%1;
    ledges.add(Math.abs(fy-.75)<.001?'+y':Math.abs(fx-.75)<.001?'+x':Math.abs(fy-.35)<.001?'-y':'-x');
   }
   if(p.layer==='light')lights.add(p.mirrorX?'+x':'+y');
   if(p.layer==='blocker')for(const [d,dx,dy] of directions)if(cell(Math.floor(p.x)+dx,Math.floor(p.y)+dy)==='#')blockerWalls.add(d);
   if(['prop','blocker','light'].includes(p.layer))mirror.add(Boolean(p.mirrorX));
  }
 }
 assert.equal(walls.size,4,kit+' 四侧墙面覆盖');
 if(kit==='cave')assert.equal(ledges.size,4,'cave 四侧岩台覆盖');
 else assert.deepEqual([...blockerWalls].sort(),['-x','-y'],kit+' 现行后两侧靠墙摆件覆盖');
 assert.deepEqual([...lights].sort(),['+x','+y'],kit+' 面向镜头的两侧挂灯');
 assert.equal(mirror.size,2,kit+' 原向与镜像');
 const expected=art.assets.filter(a=>a.kit===kit&&a.runtime.registration==='greybox-contract-exact').map(a=>a.part);
 const notPlaced=expected.filter(part=>!parts.has(part));
 // 当前 maze 随机 carve 不放独立柱；保留资源交付，不修改地图来制造覆盖。
 assert.ok(notPlaced.every(part=>kit==='maze'&&part==='pillar'),kit+' 随机场地缺少预期摆件 '+notPlaced.join(','));
 console.log(JSON.stringify({kit,seeds,wallSides:[...walls].sort(),ledgeSides:[...ledges].sort(),blockerWallSides:[...blockerWalls].sort(),lampFaces:[...lights].sort(),mirroredVariants:[...mirror],parts:[...parts].sort(),notPlaced}));
}

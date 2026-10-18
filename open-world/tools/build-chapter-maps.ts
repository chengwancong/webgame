import {readFileSync,writeFileSync} from 'node:fs';
import {parseMap} from '../packages/content/tiled.ts';
const check=process.argv.includes('--check');
const root=new URL('../packages/content/maps/',import.meta.url);
const chapters=[
 {id:'tundra',name:'冰封雪域',boss:'frost_queen',size:48,previous:'rift',next:'abyss',camp:'冰霜营地',gate:'冰之门',room:'冰霜王座',tip:'暴风雪蓄力时离开红圈，冰枪发射前侧向移动。'},
 {id:'abyss',name:'暗影深渊',boss:'abyss_lord',size:48,previous:'tundra',next:'dragonbone',camp:'光明祭坛',gate:'暗影之门',room:'深渊之口',tip:'黑暗仪式蓄力时持续攻击以打断；金色祭坛是安全地标。'},
 {id:'dragonbone',name:'龙骨荒漠',boss:'dragon_king',size:64,previous:'abyss',camp:'龙之遗迹',gate:'龙门',room:'龙王陵墓',tip:'毁灭吐息倒计时期间离开红色光束路径，或躲在岩石后。'}
];
const property=(name:string,value:string|number|boolean)=>({name,type:typeof value==='boolean'?'bool':typeof value==='number'?'float':'string',value});
for(const [i,ch] of chapters.entries())for(const boss of [false,true]){
 const size=boss?ch.size:64,id=ch.id+(boss?'-boss':'');let serial=1;
 const object=(name:string,x:number,y:number,properties:any[]=[],w=0,h=0)=>({id:serial++,name,x:x*32,y:y*32,width:w*32,height:h*32,rotation:0,visible:true,...(!w&&!h?{point:true}:{}),properties});
 const obstacles=boss?(ch.id==='dragonbone'?[[24,23,3,3],[36,23,3,3],[24,37,3,3],[36,37,3,3]]:[]):[[20,22,4,6],[40,36,6,3],[12,42,5,3]];
 const spawnPoint=(x:number,y:number)=>{const clear=(x:number,y:number)=>!obstacles.some(([ox,oy,w,h])=>x>ox-.9&&x<ox+w+.9&&y>oy-.9&&y<oy+h+.9);if(clear(x,y))return {x,y};const candidates=[];for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(clear(x+dx,y+dy))candidates.push({x:x+dx,y:y+dy,d:Math.hypot(dx,dy)});const point=candidates.sort((a,b)=>a.d-b.d)[0];if(!point)throw Error('No safe spawn near '+x+','+y);return point;};
 const navigation=obstacles.map(([x,y,w,h],n)=>object('collision-'+n,x,y,[],w,h));
 const source=JSON.parse(readFileSync(new URL(ch.id+'.tiled.json',root),'utf8')),bossSource=JSON.parse(readFileSync(new URL(ch.id+'-boss.tiled.json',root),'utf8'));
 const specs=(map:any)=>map.layers.find((l:any)=>l.name==='spawns').objects.map((o:any)=>Object.fromEntries(o.properties.map((p:any)=>[p.name,p.value])));
 const roster=[...new Map(specs(source).map((p:any)=>[p.monster,p])).values()] as any[],b=specs(bossSource)[0];
 const spawns=boss?[object(ch.boss,size/2+4,size/2,[property('monster',b.monster),property('level',b.level),property('rank',b.rank)])]:
  Array.from({length:16},(_,n)=>{const m=roster[n%roster.length];const point=spawnPoint(14+(n%4)*10,12+Math.floor(n/4)*10);return object(ch.id+'-'+n,point.x,point.y,[property('monster',m.monster),property('level',m.level),property('rank',m.rank)]);});
 const safe=boss?{x:size/2-10,y:size/2}:{x:6,y:6},portal=boss?{x:5,y:size/2}:{x:4,y:4},bossPortal={x:54,y:54};
 const landmark=(name:string,x:number,y:number,kind:string)=>object(name,x,y,[property('kind',kind)]);
 const landmarks=boss?[landmark(ch.room,size/2+8,size/2-8,'throne'),...(ch.id==='abyss'?[[16,16],[32,16],[16,32],[32,32]].map(([x,y])=>landmark('光明祭坛',x,y,'altar')):[])]:[landmark(ch.camp,6,6,'safe'),landmark(ch.gate,4,4,'portal'),landmark(ch.room,54,54,'boss')];
 const connections=[object('safe',safe.x,safe.y),object('portal',portal.x,portal.y),...(!boss?[object('boss',bossPortal.x,bossPortal.y)]:[])];
 const map={type:'map',version:'1.10',tiledversion:'1.12.2',orientation:'orthogonal',renderorder:'right-down',width:size,height:size,tilewidth:32,tileheight:32,infinite:false,nextobjectid:serial,nextlayerid:5,
  properties:[property('id',id),property('name',boss?ch.room:ch.name),property('subtitle',ch.tip),property('theme',ch.id),property('boss',boss),property('auto',true),...(!boss?[property('requireBoss',ch.previous+'-boss'),...(ch.next?[property('next',ch.next)]:[])]:[])],
  layers:[['navigation',navigation],['spawns',spawns],['landmarks',landmarks],['connections',connections]].map(([name,objects],n)=>({id:n+1,name,type:'objectgroup',visible:true,opacity:1,objects}))};
 const resolved=parseMap(map);if(check)console.log(JSON.stringify({id,monsters:resolved.spawns.length,selectorsValid:true}));else writeFileSync(new URL(id+'.tiled.json',root),JSON.stringify(map,null,2)+'\n');
}
if(check)process.exit(0);
const rift=JSON.parse(readFileSync(new URL('rift.json',root),'utf8'));rift.properties=rift.properties.filter((p:any)=>p.name!=='next');rift.properties.push(property('next','tundra'));writeFileSync(new URL('rift.json',root),JSON.stringify(rift,null,2)+'\n');
const world=JSON.parse(readFileSync(new URL('world.world',root),'utf8'));world.maps=world.maps.filter((m:any)=>!chapters.some(ch=>m.fileName.startsWith(ch.id)));
for(const ch of chapters)for(const boss of [false,true])world.maps.push({fileName:ch.id+(boss?'-boss':'')+'.tiled.json',x:world.maps.length*2200,y:0,width:(boss?ch.size:64)*32,height:(boss?ch.size:64)*32});
writeFileSync(new URL('world.world',root),JSON.stringify(world,null,2)+'\n');
console.log('Chapter 4–6 Tiled sources rebuilt (6 maps).');

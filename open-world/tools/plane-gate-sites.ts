// 箱庭位面入口选点（plane-world-design B1 / B3）：每个分区给出可走、可从登陆点到达、
// 远离营地与其他玩法物件的候选点，以及入口外 3 格的出口回落点。只读，打印 JSON。
// 用法：tsx tools/plane-gate-sites.ts <region> [每区候选数=3]
import {worldTables} from '../packages/content/world-tables.ts';
import {regionById} from '../packages/content/index.ts';
import '../packages/content/open-world/index.ts';
import {walkable,findPath} from '../packages/simulation/navigation.ts';
const [region,perZone='3']=process.argv.slice(2);if(!region)throw Error('用法：tsx tools/plane-gate-sites.ts <region> [每区候选数]');
const map=regionById(region),t=worldTables,near=(p:{x:number;y:number},rows:readonly {region:string;x:number;y:number}[],r:number)=>rows.some(o=>o.region===region&&Math.hypot(o.x-p.x,o.y-p.y)<r);
const out:Record<string,{x:number;y:number;returnX:number;returnY:number}[]>={};
for(const zone of t.zones.filter(z=>z.region===region)){
 const picks:{x:number;y:number;returnX:number;returnY:number}[]=[];
 for(let y=zone.rect.y+4;y<zone.rect.y+zone.rect.h-4&&picks.length<+perZone;y+=7)for(let x=zone.rect.x+4;x<zone.rect.x+zone.rect.w-4&&picks.length<+perZone;x+=7){
  const p={x,y};if(x<20||y<20||x>map.width-20||y>map.height-20||!walkable(map,p,1.2)||Math.hypot(map.safe.x-x,map.safe.y-y)<=12)continue;
  if(near(p,t.camps,7)||near(p,[...t.dungeonEntrances,...t.events,...t.planeGates,...t.waypoints,...t.chests,...t.landmarks,...t.outposts,...t.merchants],8)||near(p,picks.map(q=>({...q,region})),30))continue;
  const back=[[3,0],[-3,0],[0,3],[0,-3]].map(([dx,dy])=>({x:x+dx,y:y+dy})).find(q=>walkable(map,q,.8));if(!back||!findPath(map,map.safe,p,.55).length)continue;
  picks.push({x,y,returnX:back.x,returnY:back.y});
 }
 out[zone.id]=picks;
}
console.log(JSON.stringify(out));

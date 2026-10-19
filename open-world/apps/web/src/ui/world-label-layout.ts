// 世界标签避让（docs/hud-arbitration-plan.md §2.3）：锚点不动，标签只在锚点正上方让位；放不下就隐藏，不叠、不漂。
export type Rect={x:number;y:number;width:number;height:number};
/** x,y 是标签底边中点（屏幕坐标）；priority 小者先放；steps 覆盖本标签可上移的档数（0 = 只能原位或隐藏）。 */
export type WorldLabel={id:string;x:number;y:number;width:number;height:number;priority:number;steps?:number};
export type PlacedLabel={id:string;visible:boolean;x:number;y:number};
/** 1280×720 舞台上的 HUD 保留区，与方案 §1 的表一致。 */
export const hudReservedRects:readonly Rect[]=[
 {x:0,y:0,width:440,height:300},{x:1060,y:0,width:220,height:250},{x:900,y:256,width:370,height:200},{x:0,y:600,width:1280,height:120},
];
const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
const box=(l:WorldLabel,lift:number):Rect=>({x:l.x-l.width/2,y:l.y-l.height-lift,width:l.width,height:l.height});

export function layoutWorldLabels(labels:readonly WorldLabel[],options:{reserved?:readonly Rect[];viewport?:Rect;gap?:number;steps?:number}={}):PlacedLabel[]{
 const reserved=options.reserved??hudReservedRects,viewport=options.viewport??{x:0,y:0,width:1280,height:720},gap=options.gap??4,steps=options.steps??2;
 const taken:Rect[]=[],placed=new Map<string,PlacedLabel>();
 const order=[...labels].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 for(const l of order){
  let result:PlacedLabel={id:l.id,visible:false,x:l.x,y:l.y};
  for(let step=0;step<=(l.steps??steps);step++){
   const lift=step*(l.height+gap),r=box(l,lift);
   const inside=r.x>=viewport.x&&r.y>=viewport.y&&r.x+r.width<=viewport.x+viewport.width&&r.y+r.height<=viewport.y+viewport.height;
   if(!inside||reserved.some(h=>overlaps(r,h))||taken.some(t=>overlaps(r,t)))continue;
   taken.push(r);result={id:l.id,visible:true,x:l.x,y:l.y-lift};break;
  }
  placed.set(l.id,result);
 }
 return labels.map(l=>placed.get(l.id)!);
}

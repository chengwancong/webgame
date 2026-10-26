/**
 * Deterministic screen-space placement for combined name / health / intent labels.
 * The caller supplies measured dimensions and token-owned spacing. This module
 * never changes a unit's cell, visibility, combat attributes or intent.
 */
export type LabelPoint={x:number;y:number};
export type LabelRect=LabelPoint&{width:number;height:number};
export type UnitLabelRequest={
 id:string;
 /** Screen-space point above the unit, in the same coordinate space as bounds. */
 anchor:LabelPoint;
 width:number;
 height:number;
 /** Higher priority is placed first; use for the inspected/current unit. */
 priority?:number;
};
export type UnitLabelPlacement=LabelRect&{
 id:string;
 anchor:LabelPoint;
 /** True if the label had to leave its natural centered, overhead position. */
 displaced:boolean;
 leader:{from:LabelPoint;to:LabelPoint};
};
export type UnitLabelLayout={
 placed:UnitLabelPlacement[];
 /** Never overlap or silently shrink text when the available area cannot fit. */
 unplaced:{id:string;reason:'invalid-size'|'too-large'|'crowded'}[];
};
export type UnitLabelLayoutOptions={
 bounds:LabelRect;
 gap:number;
 /** Optional actor silhouettes / reserved HUD areas in the same coordinates. */
 obstacles?:readonly LabelRect[];
};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const validPoint=(point:LabelPoint)=>Number.isFinite(point.x)&&Number.isFinite(point.y);
const validRect=(rect:LabelRect)=>validPoint(rect)&&Number.isFinite(rect.width)&&Number.isFinite(rect.height)&&rect.width>0&&rect.height>0;

/** Touching at the requested clearance is allowed; intersecting that clearance is not. */
export function labelRectsOverlap(a:LabelRect,b:LabelRect,gap=0):boolean{
 return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
}

function attachment(rect:LabelRect,anchor:LabelPoint):LabelPoint{
 const point={x:clamp(anchor.x,rect.x,rect.x+rect.width),y:clamp(anchor.y,rect.y,rect.y+rect.height)};
 // If the anchor lies inside an unusually constrained placement, pick a real edge.
 if(point.x===anchor.x&&point.y===anchor.y){
  const edges=[
   {x:anchor.x,y:rect.y},
   {x:anchor.x,y:rect.y+rect.height},
   {x:rect.x,y:anchor.y},
   {x:rect.x+rect.width,y:anchor.y},
  ];
  edges.sort((a,b)=>(a.x-anchor.x)**2+(a.y-anchor.y)**2-((b.x-anchor.x)**2+(b.y-anchor.y)**2));
  return edges[0];
 }
 return point;
}

export function layoutUnitLabels(requests:readonly UnitLabelRequest[],options:UnitLabelLayoutOptions):UnitLabelLayout{
 const {bounds}=options;
 if(!validRect(bounds))throw new RangeError('Unit label bounds must be a finite positive rectangle');
 if(!Number.isFinite(options.gap)||options.gap<0)throw new RangeError('Unit label gap must be finite and nonnegative');
 const gap=options.gap;
 const obstacles=(options.obstacles??[]).filter(validRect);
 const result:UnitLabelLayout={placed:[],unplaced:[]};
 const ordered=requests.slice().sort((a,b)=>(b.priority??0)-(a.priority??0)||a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x||(a.id<b.id?-1:a.id>b.id?1:0));
 for(const request of ordered){
  const {id,anchor,width,height}=request;
  if(!validPoint(anchor)||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0){
   result.unplaced.push({id,reason:'invalid-size'});continue;
  }
  if(width>bounds.width||height>bounds.height){result.unplaced.push({id,reason:'too-large'});continue;}
  const preferred={x:anchor.x-width/2,y:anchor.y-gap-height};
  const maxX=bounds.x+bounds.width-width,maxY=bounds.y+bounds.height-height;
  const xs=new Set([clamp(preferred.x,bounds.x,maxX),bounds.x,maxX]);
  const ys=new Set([clamp(preferred.y,bounds.y,maxY),clamp(anchor.y+gap,bounds.y,maxY),bounds.y,maxY]);
  const occupied:readonly LabelRect[]=[...obstacles,...result.placed];
  // Rectangle edges are sufficient anchors for a compact, non-overlapping shelf.
  // Also retain the preferred anchor axes so one displaced unit does not move all labels.
  for(const rect of occupied){
   xs.add(clamp(rect.x-gap-width,bounds.x,maxX));xs.add(clamp(rect.x+rect.width+gap,bounds.x,maxX));
   ys.add(clamp(rect.y-gap-height,bounds.y,maxY));ys.add(clamp(rect.y+rect.height+gap,bounds.y,maxY));
  }
  const candidates:LabelRect[]=[];
  for(const x of xs)for(const y of ys){
   const candidate={x,y,width,height};
   if(!occupied.some(rect=>labelRectsOverlap(candidate,rect,gap)))candidates.push(candidate);
  }
  candidates.sort((a,b)=>((a.x-preferred.x)**2+(a.y-preferred.y)**2)-((b.x-preferred.x)**2+(b.y-preferred.y)**2)||a.y-b.y||a.x-b.x);
  const rect=candidates[0];
  if(!rect){result.unplaced.push({id,reason:'crowded'});continue;}
  result.placed.push({...rect,id,anchor:{...anchor},displaced:rect.x!==preferred.x||rect.y!==preferred.y,
   leader:{from:attachment(rect,anchor),to:{...anchor}}});
 }
 return result;
}

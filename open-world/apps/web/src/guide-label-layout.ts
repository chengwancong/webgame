/** Position the measured label as a whole; the renderer keeps its font and content. */
export function guideLabelPosition(v:{x:number;y:number;width:number;height:number;labelWidth:number;labelHeight:number;inset:number}){
 const halfWidth=v.labelWidth/2,halfHeight=v.labelHeight/2;
 return {x:Math.max(v.inset+halfWidth,Math.min(v.width-v.inset-halfWidth,v.x)),y:Math.max(v.inset+halfHeight,Math.min(v.height-v.inset-halfHeight,v.y))};
}

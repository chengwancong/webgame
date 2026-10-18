/** 星海地图碰撞由摆件美术推导：每个立体摆件在落脚点（等距菱形的最前角）后方占一块方形底座，
 * 边长 = 底座占显示宽度的比例 × displayWidth / 64（一格菱形在屏幕上宽 64px）。
 * 地图不再手填碰撞矩形，美术摆到哪里，阻挡就在哪里，不会出现空气墙或可穿过的建筑。 */
export type StarseaDecoration={id:string;resourceId:string;x:number;y:number;variant?:string;displayWidth?:number;depthMode:string};
export type StarseaBlocker={x:number;y:number;w:number;h:number;source:string};
/** 底座宽度 / 显示宽度。树只挡树干，飞艇只挡吊舱，地面类（栈桥、桥）不阻挡。 */
const baseRatio:Record<string,number>={
 'ss-scene-house':.78,'ss-scene-workshop':.8,'ss-scene-postal-station':.78,'ss-scene-observatory':.62,'ss-scene-outpost':.8,
 'ss-scene-oath-hall':.7,'ss-scene-dragonbone':.72,'ss-scene-airship':.5,'ss-scene-airship/frozen-hull':.6,'ss-scene-rocks':.62,'ss-scene-tree':.22
};
export function decorationBlockers(decorations:readonly StarseaDecoration[]):StarseaBlocker[]{
 const out:StarseaBlocker[]=[];
 for(const d of decorations){
  if(d.depthMode==='ground')continue;
  const ratio=baseRatio[d.resourceId+'/'+d.variant]??baseRatio[d.resourceId];
  if(ratio===undefined)throw Error(`Starsea decoration ${d.id} (${d.resourceId}) has no collision footprint`);
  if(!d.displayWidth)throw Error(`Starsea decoration ${d.id} lacks displayWidth`);
  const s=Math.round(ratio*d.displayWidth/64*100)/100;
  out.push({x:Math.round((d.x-s)*100)/100,y:Math.round((d.y-s)*100)/100,w:s,h:s,source:d.id});
 }
 return out;
}

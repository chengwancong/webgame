/** World/canvas projection shared by the scene and its maps; no engine dependency. */
export type IsoPoint={x:number;y:number};
export const project=(p:IsoPoint):IsoPoint=>({x:(p.x-p.y)*32,y:(p.x+p.y)*18});
export const unproject=(p:IsoPoint):IsoPoint=>({x:p.x/64+p.y/36,y:p.y/36-p.x/64});

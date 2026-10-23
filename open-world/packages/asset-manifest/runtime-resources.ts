import legacy from './starsea.v1.json';
import {openWorldRuntimeAssets} from './open-world-assets.ts';
/** Shared by browser loading and Node validation; includes every island. */
export const runtimeResources=new Map([...legacy.assets,...openWorldRuntimeAssets].map(asset=>[asset.id,asset]));
// E5 ART-HE 港口地标标记图集（ow-hub-port-marks）
const _pmFile='/art/hub-ui/port-marks.png',_pmAtlas='/art/hub-ui/port-marks.json',_pmAnchor=[0.5,1],_pmH=32;
/** lift = 建筑底点到顶部再上 8px 的显示像素：标记与建筑同脚点（同深度排序，再 +0.02 压在上面），用锚点把牌子抬到建筑头顶。 */
const _pmState=(frame:string,lift:number)=>({kind:'image',file:_pmFile,anchor:[.5,1+lift/_pmH],displayHeight:_pmH,visible:true,atlasKey:'ow-hub-port-marks',frames:[frame],fps:1});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
runtimeResources.set('ow-hub-port-marks',{id:'ow-hub-port-marks',name:'港口地标标记',group:'props',type:'',chapters:[],status:'registered',dependencies:[],notes:[],actions:{},states:{},runtime:{kind:'prop',file:_pmFile,atlas:_pmAtlas,displayHeight:_pmH,anchor:_pmAnchor,states:{stargate:_pmState('hub-mark-stargate',268),hall:_pmState('hub-mark-hall',168),forge:_pmState('hub-mark-forge',248),pier:_pmState('hub-mark-pier',72),post:_pmState('hub-mark-post',56),warehouse:_pmState('hub-mark-warehouse',168),wardrobe:_pmState('hub-mark-wardrobe',168),'pet-yard':_pmState('hub-mark-pet-yard',128)}}} as any);

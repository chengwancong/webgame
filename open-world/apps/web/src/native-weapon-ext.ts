/**
 * Axe/hammer art for the MiniFantasy rig, which has no native axe or hammer.
 * The registered hand-drawn sources (assets/mini-hero/extensions) are diagonal icons; each item
 * records its measured pommel and head pixels, and the hand bone holds the shaft at a fixed
 * fraction from the pommel with the head along the bone's +y (the rig's weapon axis).
 */
import {GLTexture,RegionAttachment,TextureAtlas,type ManagedWebGLRenderingContext,type SkeletonData,type Skin} from '@esotericsoftware/spine-webgl';

export type NativeWeaponExt={id:string;file:string;size:[number,number];pommel:[number,number];head:[number,number];
  /** mirror the source so the edge faces forward */ mirror?:boolean};
/** Rig units per source pixel and the hand position along pommel→head; matches the two-hand sword's reach. */
export const EXT_SCALE=.6,EXT_GRIP=.22;

/** Bone-local placement of a source image whose pommel→head axis maps to +y with the grip at the origin. */
export function extPlacement(item:Pick<NativeWeaponExt,'size'|'pommel'|'head'|'mirror'>,scale=EXT_SCALE,grip=EXT_GRIP){
  const [w,h]=item.size,flip=item.mirror?-1:1;
  // Image pixels → attachment-local units before rotation (center origin, y up); mirroring negates x.
  const local=([x,y]:[number,number])=>[flip*(x-w/2)*scale,(h/2-y)*scale] as const;
  const p=local(item.pommel),q=local(item.head),g=[p[0]+(q[0]-p[0])*grip,p[1]+(q[1]-p[1])*grip];
  const rotation=90-Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI,r=rotation*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  return {x:-(g[0]*c-g[1]*s),y:-(g[0]*s+g[1]*c),rotation,scaleX:flip,width:w*scale,height:h*scale,
    /** head centroid in bone-local units: the effect/trail tip */ tip:{x:(q[0]-g[0])*c-(q[1]-g[1])*s,y:(q[0]-g[0])*s+(q[1]-g[1])*c}};
}

const images=new Map<string,Promise<ImageBitmap>>();
/** Straight-alpha source premultiplied at decode so it blends like the PMA rig atlas. */
function bitmap(url:string){
  let pending=images.get(url);
  if(!pending){pending=fetch(url).then(r=>{if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);return r.blob();}).then(b=>createImageBitmap(b,{premultiplyAlpha:'premultiply'}));pending.catch(()=>images.delete(url));images.set(url,pending);}
  return pending;
}

const catalogs=new Map<string,Promise<Map<string,NativeWeaponExt>>>();
/** Registered extension items by id (extensions.json under `baseUrl`). */
export function loadExtCatalog(baseUrl:string){
  let pending=catalogs.get(baseUrl);
  if(!pending){pending=fetch(baseUrl+'extensions.json').then(r=>{if(!r.ok)throw Error(`${baseUrl}extensions.json: HTTP ${r.status}`);return r.json();}).then((json:{items:NativeWeaponExt[]})=>new Map(json.items.map(i=>[i.id,i])));pending.catch(()=>catalogs.delete(baseUrl));catalogs.set(baseUrl,pending);}
  return pending;
}

/** One GPU texture and attachment per item and context, shared by every skin that holds it. */
const attachments=new WeakMap<ManagedWebGLRenderingContext,Map<string,Promise<RegionAttachment>>>();
function extAttachment(context:ManagedWebGLRenderingContext,item:NativeWeaponExt,baseUrl:string){
  const cache=attachments.get(context)??new Map<string,Promise<RegionAttachment>>();attachments.set(context,cache);
  let pending=cache.get(baseUrl+item.id);
  if(!pending){
    pending=bitmap(baseUrl+item.file).then(image=>{
      const [w,h]=item.size;
      if(image.width!==w||image.height!==h)throw Error(`Extension weapon ${item.id} size ${image.width}x${image.height} != ${w}x${h}`);
      const atlas=new TextureAtlas(`${item.file}
size:${w},${h}
filter:Linear,Linear
pma:true
${item.id}
bounds:0,0,${w},${h}
`);
      atlas.pages[0].setTexture(new GLTexture(context,image as unknown as HTMLImageElement));
      const region=atlas.findRegion(item.id)!,attachment=new RegionAttachment('RIGHTHAND',item.id);
      attachment.region=region;Object.assign(attachment,(({tip:_,...rest})=>rest)(extPlacement(item)),{scaleY:1});attachment.updateRegion();
      return attachment;
    });
    pending.catch(()=>cache.delete(baseUrl+item.id));cache.set(baseUrl+item.id,pending);
  }
  return pending;
}

/** Puts the item into `skin` on the RIGHTHAND slot under the slot's own attachment name. */
export async function attachExtWeapon(context:ManagedWebGLRenderingContext,data:SkeletonData,skin:Skin,item:NativeWeaponExt,baseUrl:string){
  const attachment=await extAttachment(context,item,baseUrl);
  const slot=data.findSlot('RIGHTHAND');if(!slot)throw Error('RIGHTHAND slot missing');
  skin.setAttachment(slot.index,'RIGHTHAND',attachment);
  return attachment;
}

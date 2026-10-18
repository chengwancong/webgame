type AtlasActor={id:string;group:string;runtime:{kind:string;actions?:Record<string,{frames:string[];fps:number;loop?:boolean}>}};
type Animation={key:string;frames:{key:string;frame:string}[];frameRate:number;repeat:number};
export type AnimationRegistry={textures:{exists:(id:string)=>boolean};anims:{exists:(key:string)=>boolean;create:(animation:Animation)=>unknown}};
/** Called again after each region load. Unloaded atlases must remain unregistered. */
export function registerLoadedActorAnimations(scene:AnimationRegistry,assets:Iterable<AtlasActor>){
 for(const asset of assets){
  if(asset.group!=='monsters'||asset.runtime.kind!=='atlas'||!scene.textures.exists(asset.id))continue;
  for(const [action,clip] of Object.entries(asset.runtime.actions??{})){
   const key=asset.id+'-'+action;
   if(scene.anims.exists(key))continue;
   if(!clip.frames.length)throw Error('Actor animation has no frames: '+key);
   scene.anims.create({key,frames:clip.frames.map(frame=>({key:asset.id,frame})),frameRate:clip.fps,repeat:clip.loop?-1:0});
  }
 }
}

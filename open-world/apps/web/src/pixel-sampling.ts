type Source={scaleMode:number;setFilter:(mode:number)=>void};
type Texture={key:string;source:Source[];setFilter:(mode:number)=>unknown};
type Node={texture?:Texture;list?:Node[]};
/** Dynamic character canvases inherit the normal game's LINEAR filter unless explicitly switched. */
export class PixelCanvasSampling{
 private saved=new Map<Texture,number[]>();
 apply(nodes:Iterable<unknown>){for(const value of nodes){const node=value as Node;if(node.list)this.apply(node.list);const texture=node.texture;if(!texture||!/^(hero-live-|wardrobe-live-|story-npc-|starsea-native-frame-|pixel-native:)/.test(texture.key))continue;
  if(!this.saved.has(texture))this.saved.set(texture,texture.source.map(s=>s.scaleMode));
  if(texture.source.some(s=>s.scaleMode!==1))texture.setFilter(1);
 }}
 ensure(){for(const texture of this.saved.keys()){if(!texture.source?.length){this.saved.delete(texture);continue;}if(texture.source.some(s=>s.scaleMode!==1))texture.setFilter(1);}}
 restore(){for(const[texture,modes]of this.saved)texture.source?.forEach((source,i)=>{if(modes[i]!==undefined&&source.scaleMode!==modes[i])source.setFilter(modes[i]);});this.saved.clear();}
}

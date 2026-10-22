import Phaser from 'phaser';
import {actorCatalog} from '../../../packages/asset-manifest/actors.ts';

/** Old-campaign actor atlases (~59 MB in total) load on first use instead of at boot.
 * Only the hero atlas is preloaded; region entry waits for the rest it needs, and an
 * unexpected spawn stays hidden for the few frames its atlas takes to arrive. */
const legacy=Object.entries(actorCatalog).filter(([,a])=>a.source!=='starsea');
export const legacyTexture=(art:string)=>{const a=actorCatalog[art];return a&&a.source!=='starsea'?a.texture??art:undefined;};
export const bootLegacyTextures=[legacyTexture('hero')!];
export function preloadLegacyActorArt(scene:Phaser.Scene,textures:Iterable<string>=bootLegacyTextures){for(const key of textures)scene.load.atlas(key,'/art/'+key+'.png','/art/'+key+'.json');}

export class LegacyActorArt{
 private pending=new Set<string>();private failed=new Set<string>();private waiters:{keys:Set<string>;done:()=>void}[]=[];
 constructor(private scene:Phaser.Scene){
  scene.textures.on(Phaser.Textures.Events.ADD,(key:string)=>{if(this.pending.delete(key)){this.createAnimations(key);this.settle();}});
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR,(file:Phaser.Loader.File)=>{if(this.pending.delete(file.key)){this.failed.add(file.key);console.error('[legacy-art] atlas failed',file.key);this.settle();}});
  // Files queued while the loader was finishing are dropped by Phaser: queue them again.
  scene.load.on(Phaser.Loader.Events.COMPLETE,()=>{if(this.pending.size)setTimeout(()=>this.request([...this.pending]),0);});
  for(const key of new Set(legacy.map(([id,a])=>a.texture??id)))if(scene.textures.exists(key))this.createAnimations(key);
 }
 /** True when the art is not a legacy atlas or its atlas is usable (or failed: fall back like before). */
 ready(art:string){const key=legacyTexture(art);return !key||this.failed.has(key)||this.scene.textures.exists(key);}
 /** Starts loading every missing atlas; `done` runs once they have all arrived. Returns true when nothing was missing. */
 ensure(arts:Iterable<string>,done?:()=>void){
  const keys=new Set<string>();for(const art of arts){const key=legacyTexture(art);if(key&&!this.ready(art))keys.add(key);}
  if(!keys.size)return true;if(done)this.waiters.push({keys,done});
  this.request([...keys].filter(key=>!this.pending.has(key)));return false;
 }
 private request(keys:string[]){
  if(!keys.length)return;for(const key of keys)this.pending.add(key);
  preloadLegacyActorArt(this.scene,keys);if(!this.scene.load.isLoading())this.scene.load.start();
 }
 private settle(){const done=this.waiters.filter(w=>[...w.keys].every(key=>!this.pending.has(key)));this.waiters=this.waiters.filter(w=>!done.includes(w));for(const w of done)w.done();}
 private createAnimations(key:string){
  for(const [name,a] of legacy)if((a.texture??name)===key)for(const [action,count] of Object.entries(a.actions)){const anim=name+'-'+action;if(!this.scene.anims.exists(anim))this.scene.anims.create({key:anim,frames:Array.from({length:count},(_,i)=>({key,frame:action+'_'+i})),frameRate:a.fps,repeat:['idle','move'].includes(action)?-1:0});}
 }
}

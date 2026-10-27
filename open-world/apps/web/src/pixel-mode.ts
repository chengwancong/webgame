/** Authored pixel style toggle. World raster = 640x360; text and DOM stay separate. */
import Phaser from 'phaser';
import {installPixelImages} from './pixel-images.ts';
import {pixelFrameUrl,type PixelFrame} from './ui/pixel-frames.ts';
import {setPixelCell,pixelRuntime} from './pixel-texture.ts';
import {preparePixelAssets,applyAuthoredWorldAsset,restoreAuthoredWorldAssets,updateAuthoredAtlasActors} from './pixel-world-assets.ts';
import {PixelWorldTarget} from './pixel-world-target.ts';
export type PixelSettings={on:boolean;size:2|3|4};
export const defaultPixelSettings:PixelSettings={on:false,size:2};
/** Old density values remain readable; authored rendering always uses x2. */
export function parsePixelSettings(raw:unknown):PixelSettings{if(typeof raw!=='object'||!raw)return defaultPixelSettings;const o=raw as any;return{on:o.on===true,size:[2,3,4].includes(o.size)?o.size:2};}
export function blockPixels(size:2|3|4,backingScale:number){const b2=Math.max(2,Math.round(2*backingScale)),b3=Math.max(b2+1,Math.round(3*backingScale));return size===2?b2:size===3?b3:Math.max(b3+1,Math.round(4*backingScale));}
export function snapToBlock(value:number,blockWorld:number){return blockWorld<=0?value:Math.round(value/blockWorld)*blockWorld;}
type State={target?:PixelWorldTarget;textCam?:Phaser.Cameras.Scene2D.Camera;text:Set<Phaser.GameObjects.GameObject>;other:Set<Phaser.GameObjects.GameObject>;pending:Set<Phaser.GameObjects.GameObject>;preOff?:()=>void;addedOff?:()=>void;resizeOff?:()=>void;on:boolean};
const states=new WeakMap<Phaser.Scene,State>();
const skip=['wardrobe-live-','hero-live-','story-npc-','starsea-native-frame-','starsea-native-blank','pixel-native:','pixel-authored:'];
function process(scene:Phaser.Scene,objects:Iterable<Phaser.GameObjects.GameObject>=scene.children.list){if(!pixelRuntime.cellStage)return;const visit=(o:Phaser.GameObjects.GameObject)=>{const children=(o as Phaser.GameObjects.Container).list;if(children)for(const child of children)visit(child);if(o.type!=='Image'&&o.type!=='Sprite')return;const image=o as Phaser.GameObjects.Image,key=image.texture?.key;if(!key||image.getData('pixel-authored')||skip.some(p=>key.startsWith(p)))return;applyAuthoredWorldAsset(scene,image,()=>process(scene));};for(const o of objects)visit(o);}
function mask(o:Phaser.GameObjects.GameObject,state:State,scene:Phaser.Scene){if(o.type==='Text'){scene.cameras.main.ignore(o);state.text.add(o);}else{state.textCam!.ignore(o);state.other.add(o);}}
function stop(scene:Phaser.Scene,state:State){state.on=false;state.preOff?.();state.addedOff?.();state.resizeOff?.();state.preOff=state.addedOff=state.resizeOff=undefined;state.target?.destroy();state.target=undefined;if(state.textCam){const id=state.textCam.id;for(const o of state.other)o.cameraFilter&=~id;scene.cameras.remove(state.textCam,true);state.textCam=undefined;}const main=scene.cameras.main;if(main)for(const o of state.text)o.cameraFilter&=~main.id;state.text.clear();state.other.clear();state.pending.clear();restoreAuthoredWorldAssets(scene);}
export function applyPixelMode(scene:Phaser.Scene,settings:PixelSettings){
 installPixelImages();let state=states.get(scene);if(!state){state={text:new Set,other:new Set,pending:new Set,on:false};states.set(scene,state);}const s=state,main=scene.cameras.main;
 if(!settings.on){stop(scene,s);if(pixelRuntime.cellStage)setPixelCell(0);document.body.classList.remove('pixel-mode');document.documentElement.removeAttribute('data-pixel-size');return;}
 s.on=true;void preparePixelAssets().then(()=>{if(s.on)process(scene);}).catch(error=>console.error('[pixel-mode] Approved manifest unavailable',error));
 if(pixelRuntime.cellStage!==2)setPixelCell(2);
 if(!s.textCam){s.textCam=scene.cameras.add(0,0,main.width,main.height,false,'pixel-text-cam');s.textCam.setBackgroundColor('rgba(0,0,0,0)');for(const o of scene.children.list)mask(o,s,scene);const added=(o:Phaser.GameObjects.GameObject)=>{mask(o,s,scene);s.pending.add(o);};scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE,added);s.addedOff=()=>scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE,added);}
 s.target??=new PixelWorldTarget(scene);s.textCam.ignore(s.target.target);
 if(!s.preOff){const render=()=>{if(s.pending.size){process(scene,[...s.pending].filter(o=>o.scene));s.pending.clear();}main.setScroll(snapToBlock(main.scrollX,2),snapToBlock(main.scrollY,2));updateAuthoredAtlasActors(scene);s.target?.render();if(s.textCam){if(s.target)s.textCam.ignore(s.target.target);if(s.textCam.width!==main.width||s.textCam.height!==main.height)s.textCam.setSize(main.width,main.height);s.textCam.setScroll(main.scrollX,main.scrollY).setZoom(main.zoom);}};scene.events.on(Phaser.Scenes.Events.PRE_RENDER,render);s.preOff=()=>scene.events.off(Phaser.Scenes.Events.PRE_RENDER,render);}
 if(!s.resizeOff){const resized=()=>{if(s.on)applyPixelMode(scene,settings);};scene.scale.on('resize',resized);s.resizeOff=()=>scene.scale.off('resize',resized);}
 process(scene);document.body.classList.add('pixel-mode');document.documentElement.setAttribute('data-pixel-size','2');for(const frame of ['panel','inset','primary','secondary','danger'] as PixelFrame[])document.documentElement.style.setProperty('--px-frame-'+frame,pixelFrameUrl(frame));const scale=Number(document.documentElement.style.getPropertyValue('--stage-scale')||'1');document.documentElement.style.setProperty('--px',`${2*scale}px`);
}
export function hookPixelModeShutdown(scene:Phaser.Scene){scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{const state=states.get(scene);if(state)stop(scene,state);states.delete(scene);});}

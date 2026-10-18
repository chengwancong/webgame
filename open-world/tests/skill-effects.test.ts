import {describe,it,expect,vi} from 'vitest';
vi.mock('phaser',()=>({default:{BlendModes:{ADD:1,NORMAL:0}}}));
import {SkillEffects} from '../apps/web/src/skill-effects.ts';
import {sourceFrame,skillSourceClip,skillProjectileClip,projectFx,projectileLayout,type FxClip} from '../apps/web/src/skill-fx-layout.ts';
import source from '../packages/asset-manifest/skill-fx.json';
import {World} from '../packages/simulation/index.ts';
import {skillCatalog,regionById} from '../packages/content/index.ts';
import type {CombatEvent} from '../packages/simulation/index.ts';

function fixture(){
 const images:any[]=[];
 const scene={textures:{exists:()=>true,get:()=>({has:()=>true})},add:{graphics:()=>{const hint:any={destroy(){},clear(){return this;},setDepth(){return this;},lineStyle(){return this;},strokeEllipse(){return this;}};return hint;},image:(_x:number,_y:number,key:string,frame:string)=>{
  const image:any={texture:{key},frame:{name:frame,realWidth:160,realHeight:80},destroyed:false,destroy(){this.destroyed=true;},setFrame(name:string){this.frame.name=name;return this;}};
  for(const [method,fields]of Object.entries({setOrigin:['originX','originY'],setPosition:['x','y'],setScale:['scaleX','scaleY'],setAlpha:['alpha'],setDepth:['depth'],setBlendMode:['blend'],setVisible:['visible'],setFlipX:['flipX'],setRotation:['rotation']}))image[method]=(...values:any[])=>{fields.forEach((field,index)=>image[field]=values[index]);return image;};images.push(image);return image;
 }}};
 const world=new World(regionById('town'),{hp:300,attack:20,armor:4,speed:6,mana:100,regen:10,effects:[]},skillCatalog,[]);world.hero.position={x:2,y:2};
 let moved=0;const attachment=(id:string,name:string)=>{const foot=projectFx(id==='hero'?world.hero.position:{x:8,y:2});return {x:foot.x+moved,y:foot.y-(name==='feet'?0:name==='muzzle'?40:name==='weapon'?30:50)};};
 const fx=new SkillEffects(scene as any,()=>false,attachment,()=>({art:'hero',frame:'wardrobe-attack_8',position:projectFx(world.hero.position),scale:1,flip:false,skill:'cut'}));
 return {world,fx,images,moveSockets:(by:number)=>moved=by};
}
function release(id:string,tick=1):CombatEvent{return {type:'cast_released',id:'hero',skill:id,tick,position:{x:2,y:2},origin:{x:2,y:2},target:{x:8,y:2},radius:3};}

describe('source effect rendering contract',()=>{
 it('maps every current skill to a real source clip, and air delivery never uses ground art',()=>{
  for(const skill of skillCatalog){expect(source.clips).toHaveProperty(skillSourceClip(skill));if(skill.kind==='projectile'){const clip=skillProjectileClip(skill);expect(source.clips).toHaveProperty(clip);expect((source.clips as any)[clip].kind).toBe('sprite');}}
  expect(skillProjectileClip({id:'fireball',kind:'projectile'})).toBe('flaming-arrow');expect(skillProjectileClip({id:'frost_bolt',kind:'projectile'})).toBe('ice-air');
  expect(skillProjectileClip({id:'lightning_bolt',kind:'projectile'})).toBe('lightning');
 });
 it('honours nonuniform original attachment keys, empty frames and reduced static art',()=>{
  const clip:FxClip={frames:['a','b'],fps:30,duration:1,blend:'normal',origin:[.5,.5],nativeFacing:'right',timeline:[{time:0,frame:null},{time:.1,frame:0},{time:.7,frame:1},{time:.9,frame:null}]};
  expect(sourceFrame(clip,.05,false)).toBeUndefined();expect(sourceFrame(clip,.6,false)).toBe('a');expect(sourceFrame(clip,.8,false)).toBe('b');expect(sourceFrame(clip,.95,false)).toBeUndefined();expect(sourceFrame(clip,1.8,false,true)).toBe('b');expect(sourceFrame(clip,50,true)).toBe('a');
 });
 it('sorts a flight by its own ground, irrespective of its elevated sprite anchor',()=>{
  const layout=projectileLayout({x:1,y:2},{x:2,y:2},.5,{x:1,y:2},{x:8,y:2},{x:5,y:-60},{x:0,y:-30});expect(layout.depth).toBe(projectFx({x:1.5,y:2}).y+3);expect(layout.position.y).toBeLessThan(layout.ground.y);
 });
 it('consumes a world tick once and cancels instead of replaying stale effects after death',()=>{
  const {world,fx}=fixture();world.tick=1;world.events=[release('cut')];for(let i=0;i<60;i++)fx.consume(world);fx.draw(world,.5);expect(fx.diagnostics().totalConsumed).toBe(1);expect(fx.diagnostics().flashes).toBe(1);
  world.hero.hp=0;for(let i=0;i<60;i++){fx.consume(world);fx.draw(world,.9);}expect(fx.diagnostics()).toMatchObject({totalConsumed:1,flashes:0,projectiles:0,images:[],cancelReason:'hero-dead'});
 });
 it('retimes the complete slash to eight recovery ticks, then removes it',()=>{
  const {world,fx}=fixture();world.tick=1;world.events=[release('cut')];fx.consume(world);fx.draw(world,0);world.tick=5;fx.draw(world,0);expect(fx.diagnostics().images.some(image=>image.clip==='slash')).toBe(true);world.tick=9;fx.draw(world,0);expect(fx.diagnostics().flashes).toBe(0);expect(fx.diagnostics().images).toHaveLength(0);
 });
 it('freezes projectile positions, source frames, ages and effect count during pause',()=>{
  const {world,fx}=fixture();world.tick=10;world.projectiles=[{id:1,position:{x:3,y:2},previous:{x:2.5,y:2},direction:{x:1,y:0},origin:{x:2,y:2},target:{x:8,y:2},owner:'hero',targetId:'target',skill:'bolt',damage:10,life:20,enemy:false,pierce:false,hit:new Set()}];fx.draw(world,.35);const before=fx.diagnostics();world.paused=true;for(let i=0;i<60;i++)fx.draw(world,i/60);const after=fx.diagnostics();expect(after.images).toEqual(before.images);expect(after.clock).toBe(before.clock);expect(after.totalCreated).toBe(before.totalCreated);
 });
 it('fixes instant shot endpoints at release, keeps arrow dimensions, and clears all owned images on destroy',()=>{
  const {world,fx,images,moveSockets}=fixture();world.tick=1;world.events=[release('snipe')];fx.consume(world);fx.draw(world,.2);const before=fx.diagnostics().images.find(image=>image.role==='beam');expect(before?.clip).toBe('arrow');expect(before?.scale[0]).toBe(before?.scale[1]);moveSockets(100);world.tick=2;fx.draw(world,.2);const after=fx.diagnostics().images.find(image=>image.role==='beam');expect(after?.endpoints).toEqual(before?.endpoints);expect(after?.x).toBe(before?.x);fx.destroy();expect(fx.diagnostics().images).toHaveLength(0);expect(images.every(image=>image.destroyed)).toBe(true);
 });
 it('keeps fire source pieces at a zone location and sorted by each local ground while the caster moves',()=>{
  const {world,fx}=fixture();world.tick=10;world.zones=[{id:1,position:{x:8,y:2},radius:3,damage:10,life:100,delay:0,enemy:false,slow:false,skill:'ember',started:1}];fx.draw(world,.2);const before=fx.diagnostics().images.filter(image=>image.role==='zone-upright');expect(before).toHaveLength(5);expect(before.every(image=>image.clip==='orange-fire'&&image.depth===image.ground.y+1)).toBe(true);world.hero.position={x:15,y:15};world.tick=11;fx.draw(world,.2);const after=fx.diagnostics().images.filter(image=>image.role==='zone-upright');expect(after.map(image=>[image.x,image.y,image.ground])).toEqual(before.map(image=>[image.x,image.y,image.ground]));expect(after.some(image=>image.clip==='nature-aura-05')).toBe(false);
 });
});

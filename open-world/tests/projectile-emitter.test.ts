import {it,expect,vi} from 'vitest';
vi.mock('phaser',()=>({default:{BlendModes:{ADD:1,NORMAL:0}}}));
vi.mock('../apps/web/src/vfx-pool.ts',()=>({VfxPool:class{
 nodes=new Map<string,any>();used=new Set<string>();
 begin(){this.used.clear();}visible(){return true;}clear(){this.nodes.clear();}destroy(){this.clear();}stats(){return {active:this.nodes.size};}
 graphics(){const node:any=new Proxy({}, {get:()=>()=>node});return node;}
 image(key:string){this.used.add(key);let node=this.nodes.get(key);if(!node){node={frame:{realWidth:64,realHeight:64},key};for(const [method,fields]of Object.entries({setOrigin:['originX','originY'],setPosition:['x','y'],setScale:['scaleX','scaleY'],setAlpha:['alpha'],setDepth:['depth'],setBlendMode:['blend'],setFlipX:['flipX'],setRotation:['rotation'],setTint:['tint'],setTintMode:['tintMode'],setCrop:['cropX','cropY','cropWidth','cropHeight'],setDisplaySize:['width','height'],setFlip:['flipX','flipY']}))node[method]=(...values:any[])=>{fields.forEach((field,index)=>node[field]=values[index]);return node;};this.nodes.set(key,node);}return node;}
 end(){for(const key of this.nodes.keys())if(!this.used.has(key))this.nodes.delete(key);}images(){return [...this.nodes.values()].map(({key,x,y}:any)=>({key,x,y}));}
}}));
import {skillEmitter} from '../apps/web/src/projectile-emitter.ts';
import {SkillEffects} from '../apps/web/src/combat-vfx.ts';
import {projectileLayout,projectFx} from '../apps/web/src/skill-fx-layout.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import {skillCatalog,regionById} from '../packages/content/index.ts';
import {World} from '../packages/simulation/index.ts';

it('covers every flight skill and separates thrown hands, spell foci and arrow emitters and motions',()=>{
 expect(skillCatalog.filter(s=>s.kind==='projectile')).toHaveLength(18);
 for(const id of ['throwing_knife','fan_of_knives','venom_needle','explosive_kunai'])expect(skillEmitter(id)).toEqual({socket:'hand',action:'skill'});
 for(const skill of skillCatalog.filter(s=>s.kind==='projectile'))expect(skillEmitter(skill.id),skill.id).toBeDefined();
 for(const id of ['bolt','multi_shot','pierce_arrow','explosive_shot','poison_arrow','volley','snipe','dark_arrow']){expect(skillEmitter(id)).toEqual({socket:'muzzle',action:'projectile'});expect(vfxProfiles['player/'+id].anchor).toBe('muzzle');}
 for(const id of ['lance','arcane_missile','frost_bolt','lightning_bolt','fireball','chain','petrify']){expect(skillEmitter(id)).toEqual({socket:'muzzle',action:'skill'});expect(vfxProfiles['player/'+id].anchor).toBe('muzzle');}
 expect(vfxProfiles['monster/ice_arrow'].anchor).toBe('muzzle');expect(vfxProfiles['boss/ice_lance'].anchor).toBe('muzzle');
});

it('starts exactly at the captured emitter and interpolates height on the same fractional tick as travel',()=>{
 const origin={x:2,y:2},target={x:8,y:2},next={x:3,y:2},from={x:15,y:-60},to={x:0,y:-30};
 const first=projectileLayout(origin,next,0,origin,target,from,to),last=projectileLayout(origin,next,1,origin,target,from,to),half=projectileLayout(origin,next,.5,origin,target,from,to);
 expect(first.position).toEqual({x:15,y:12});
 expect(half.position.x).toBeCloseTo((first.position.x+last.position.x)/2);expect(half.position.y).toBeCloseTo((first.position.y+last.position.y)/2);
 expect(projectileLayout(next,{x:4,y:2},0,origin,target,from,to).position).toEqual(last.position);
});

function fixture(skill:string){
 const world=new World(regionById('town'),{hp:300,attack:20,armor:4,speed:6,mana:100,regen:10,effects:[]},skillCatalog,[]);world.tick=10;world.hero.position={x:2,y:2};
 world.projectiles=[{id:1,position:{x:3,y:2},previous:{x:2,y:2},direction:{x:1,y:0},origin:{x:2,y:2},target:{x:8,y:2},owner:'hero',sourceId:'hero',targetId:'target',skill,vfxKey:'player/'+skill,damage:10,life:20,enemy:false,pierce:false,hit:new Set()}];
 const calls:any[]=[],scene:any={textures:{exists:()=>true,get:()=>({has:()=>true})}};
 const attachment=(id:string,name:string,release?:boolean)=>{calls.push({id,name,release});const foot=projectFx(id==='hero'?world.hero.position:{x:8,y:2});return {x:foot.x+(name==='hand'?12:name==='muzzle'?48:0),y:foot.y-(name==='feet'?0:name==='hand'?release?60:80:name==='muzzle'?release?40:20:50)};};
 const fx=new SkillEffects(scene,()=>false,attachment,()=>({art:'hero',frame:'mini-skill_13',releaseFrame:'mini-skill_9',position:projectFx(world.hero.position),scale:1,flip:false,skill}));
 return {world,fx,calls};
}

it('samples the authored release focus once, then flies independently of caster movement and recovery',()=>{
 // Spells leave the staff orb (muzzle) since 2026-10-16; thrown weapons keep the hand.
 const {world,fx,calls}=fixture('fireball');world.hero.position={x:4,y:4};fx.draw(world,0);
 const launch=fx.diagnostics().flights[0];expect(launch).toMatchObject({emitter:'muzzle',launch:{x:48,y:32},frame:'mini-skill_9'});
 expect(fx.diagnostics().images.find(i=>i.key==='projectile:1')).toMatchObject({x:48,y:32});expect(calls.some(c=>c.id==='hero'&&c.name==='muzzle'&&c.release===true)).toBe(true);expect(calls.some(c=>c.id==='hero'&&c.name==='hand')).toBe(false);
 world.hero.position={x:10,y:10};calls.length=0;world.tick++;fx.draw(world,.5);expect(fx.diagnostics().flights[0]).toEqual(launch);expect(calls.some(c=>c.id==='hero')).toBe(false);
 const before=fx.diagnostics();world.paused=true;for(let i=0;i<5;i++)fx.draw(world,i/5);expect(fx.diagnostics().images).toEqual(before.images);expect(fx.diagnostics().clock).toBe(before.clock);
});

it('releases thrown weapons from the hand',()=>{
 const {world,fx,calls}=fixture('throwing_knife');fx.draw(world,0);expect(fx.diagnostics().flights[0]).toMatchObject({emitter:'hand',launch:{x:12,y:12}});expect(calls.some(c=>c.name==='hand'&&c.release===true)).toBe(true);
});

it('uses the arrow release socket, clears its snapshot after the projectile disappears, and resets on world replacement',()=>{
 const {world,fx,calls}=fixture('bolt');fx.draw(world,0);expect(fx.diagnostics().flights[0]).toMatchObject({emitter:'muzzle',launch:{x:48,y:32}});expect(calls.some(c=>c.name==='muzzle'&&c.release===true)).toBe(true);
 world.projectiles=[];fx.draw(world,0);expect(fx.diagnostics().flights).toHaveLength(0);expect(fx.diagnostics().images).toHaveLength(0);
 fx.reset();expect(fx.diagnostics().flights).toHaveLength(0);
});

it('keeps instant arrow and spell ray endpoints at their own release sockets after the caster moves',()=>{
 for(const skill of ['snipe','chain','petrify']){
  const {world,fx,calls}=fixture(skill);world.projectiles=[];world.events=[{type:'cast_released',id:'hero',sourceId:'hero',castId:1,vfxKey:'player/'+skill,skill,tick:10,position:{x:2,y:2}},{type:'hit_resolved',id:'target',sourceId:'hero',castId:1,vfxKey:'player/'+skill,skill,tick:10,position:{x:8,y:2},amount:10}];
  fx.consume(world);fx.draw(world,0);expect(fx.diagnostics().beamSegments).toBe(1);expect(calls.some(c=>c.id==='hero'&&c.name==='muzzle'&&c.release)).toBe(true);
  world.hero.position={x:10,y:10};world.tick++;calls.length=0;fx.draw(world,0);expect(fx.diagnostics().beamSegments).toBe(1);expect(calls.some(c=>c.id==='hero')).toBe(false);
 }
});

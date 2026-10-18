/**
 * Plane scene review (Claude, 2026-10-18): the real WorldScene renders one carved plane stage with its real
 * collision and monsters; no account, no writes. ?stage=<id>&calm=1 (monsters removed). awPlaneWalk walks the
 * hero along points with the real path finder; awPlaneStages lists the stages. &seed=<n> (or seed=random) shows
 * the random run layout for that seed, exactly as a dungeon run would generate it. &island=<mist|forge|…>
 * dresses the stage in another island's parts and material (same layout).
 */
import Phaser from 'phaser';
import {planeMaps} from '../../../packages/content/open-world/index.ts';
import {World} from '../../../packages/simulation/index.ts';
import {regionById} from '../../../packages/content/index.ts';
import {generatePlaneStage} from '../../../packages/content/plane-layouts.ts';
import {buildPlaneStage,planeStageSpecs} from '../../../packages/content/plane-scenes.ts';
import {WorldScene} from './scene.ts';

const params=new URLSearchParams(location.search),stage=params.get('stage')??'plane-wind-nest-cave-1',seedParam=params.get('seed'),seed=seedParam==='random'?1+Math.floor(Math.random()*2147483646):Number(seedParam)||0;
const island=params.get('island')?'ss-map-'+params.get('island'):undefined,authored=planeStageSpecs.find(s=>s.id===stage)!;
const run=seed?generatePlaneStage(stage,seed,island):island?buildPlaneStage({...authored,island}):undefined,region=run?.region??regionById(stage);console.info('plane layout seed',seed||'authored');
const world=new World(region,{hp:1e9,attack:40,armor:0,speed:6,mana:100,regen:10,effects:[]},[],params.get('calm')?[]:structuredClone(region.spawns));world.setMode('manual');
const bridge={motionReduced:false,world,planeMap:run?.map??planeMaps[stage],rewards:[],panel:'',loggedIn:true,step(){world.step();},interact(){},cast(){},pause(){},open(){},pick(){},sound(){}};
const scene=new WorldScene(bridge as never);
new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:1280,height:720,scene:[scene],audio:{noAudio:true},fps:{target:60,forceSetTimeOut:true}} as Phaser.Types.Core.GameConfig);
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
Object.defineProperty(window,'awPlaneStages',{value:()=>Object.keys(planeMaps)});
Object.defineProperty(window,'awPlaneLayout',{value:()=>({seed,safe:region.safe,chests:region.keyChests,route:run?.spec.route})});
Object.defineProperty(window,'awPlaneWalk',{value:async(points:[number,number][],timeoutMs=20000)=>{const log:string[]=[];
 for(const [x,y] of points){world.go({x,y});const start=performance.now();while(Math.hypot(world.hero.position.x-x,world.hero.position.y-y)>.8&&performance.now()-start<timeoutMs)await wait(100);
  const p=world.hero.position;log.push(`${x},${y} -> ${p.x.toFixed(1)},${p.y.toFixed(1)}`);}
 return log;}});
Object.defineProperty(window,'awPlaneTeleport',{value:(x:number,y:number)=>{world.hero.position={x,y};world.setMode('manual');}});
Object.defineProperty(window,'awPlaneDiagnostics',{value:()=>(scene as any).planeScene?.diagnostics()});
Object.defineProperty(window,'awPlaneWorld',{value:()=>({tick:world.tick,paused:world.paused,mode:world.mode,hero:{...world.hero.position},enemies:world.enemies.map(e=>({id:e.id,art:e.art,alive:e.alive,x:+e.position.x.toFixed(1),y:+e.position.y.toFixed(1)}))})});

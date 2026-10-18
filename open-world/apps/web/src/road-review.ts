/**
 * Road look review (Claude, 2026-10-16): the real WorldScene renders a production island with no enemies, no account
 * and no writes; awRoadShots moves the hero along the island roads and saves one sheet to .qa/review-sheets/ (local only).
 */
import Phaser from 'phaser';
import '../../../packages/content/open-world/index.ts';
import {fieldMaps} from '../../../packages/content/open-world/index.ts';
import {World} from '../../../packages/simulation/index.ts';
import {regionById} from '../../../packages/content/index.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {WorldScene} from './scene.ts';
import type {StarseaMap} from './starsea-world-renderer.ts';

const island=new URLSearchParams(location.search).get('island')??'ss-map-wind';
const landing=worldTables.waypoints.find(w=>w.region===island&&w.kind==='landing')!;
const world=new World({...regionById(island),safe:{x:landing.x,y:landing.y},spawns:[]},{hp:1e9,attack:0,armor:0,speed:6,mana:100,regen:10,effects:[]},[],[]);world.setMode('manual');
const bridge={motionReduced:false,world,worldMap:fieldMaps[island] as StarseaMap,rewards:[],panel:'',loggedIn:true,step(){world.step();},interact(){},cast(){},pause(){},open(){},pick(){},sound(){}};
const scene=new WorldScene(bridge as never),game=new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:1280,height:720,scene:[scene],audio:{noAudio:true},preserveDrawingBuffer:true} as Phaser.Types.Core.GameConfig);
let clock=performance.now();
const pump=async(n:number)=>{for(let i=0;i<n;i++){clock+=1000/60;game.step(clock,1000/60);await new Promise(r=>setTimeout(r,16));}};
Object.defineProperty(window,'awRoadShots',{value:async(points:[number,number][],name:string,cols=3)=>{
 const W=640,H=360,canvas=document.createElement('canvas');canvas.width=W*cols;canvas.height=H*Math.ceil(points.length/cols);const g=canvas.getContext('2d')!;g.font='16px sans-serif';
 for(const [i,[x,y]] of points.entries()){world.hero.position={x,y};await pump(40);g.drawImage(game.canvas,0,0,1280,720,(i%cols)*W,Math.floor(i/cols)*H,W,H);g.fillStyle='#000a';g.fillRect((i%cols)*W,Math.floor(i/cols)*H,110,24);g.fillStyle='#fff';g.fillText(`${x},${y}`,(i%cols)*W+6,Math.floor(i/cols)*H+17);}
 const blob=await new Promise<Blob>((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('empty')),'image/jpeg',.88));const r=await fetch('/__review/'+name+'.png',{method:'POST',body:blob});if(!r.ok)throw Error(await r.text());return name;
}});
Object.defineProperty(window,'awRoadMap',{value:()=>bridge.worldMap});

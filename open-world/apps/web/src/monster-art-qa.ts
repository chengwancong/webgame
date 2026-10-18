/** QA-only entry. Uses the real scene and published art; never imports the online app or writes assets. */
import Phaser from 'phaser';
import {WorldScene} from './scene';
import {World} from '../../../packages/simulation/index';
import {regionById} from '../../../packages/content/index';
import catalog from '../../../packages/asset-manifest/catalog.json';
const entries=Object.entries(catalog.actors).filter(([key])=>key!=='hero');
const center={x:24,y:24};
const spawns=entries.map(([key,profile],i)=>{const dx=(i%6-2.5)*220,dy=i<6?-65:170;return {id:key,art:key,name:(profile as any).displayName,x:center.x+dx/64+dy/36,y:center.y-dx/64+dy/36,hp:100,attack:1,kind:'melee' as const,elite:key.includes('boss')||i===0,boss:key.includes('boss')};});
const region={...regionById('meadow'),id:'monster-art-qa',safe:center,obstacles:[],landmarks:[],width:64,height:64};
const world=new World(region,{hp:300,attack:20,armor:4,speed:6,mana:100,regen:10,effects:[]},[],spawns);world.hero.position=center;world.mode='manual';
// Fixed actor positions isolate animation/foot anchors; the production game is tested separately.
const bridge={world,rewards:[],panel:'',loggedIn:true,step(){world.tick++;},interact(){},cast(){},pause(){},open(){},pick(){},sound(){},motionReduced:true};
const scene=new WorldScene(bridge);new Phaser.Game({type:Phaser.WEBGL,width:1600,height:900,backgroundColor:'#153c37',scene:[scene],audio:{noAudio:true}});
function play(action:string){for(const e of world.enemies){e.alive=true;e.hp=100;e.action=action;e.actionUntil=world.tick+60;}if(action==='death')for(const e of world.enemies){e.alive=false;e.hp=0;}return action;}
for(const el of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]')))el.onclick=()=>play(el.dataset.action!);
document.querySelector<HTMLButtonElement>('#flip')!.onclick=()=>{for(const e of world.enemies)e.facing*=-1;};
for(const [i,e] of spawns.entries()){const label=document.createElement('div');label.className='label';label.style.left=String(800+(i%6-2.5)*220-105)+'px';label.style.top=String(450+(i<6?-65:170)+40)+'px';label.textContent=e.name;document.querySelector('#labels')!.append(label);}
Object.assign(window,{monsterQA:{world,scene,play,ready:()=>Boolean((scene as any).actors?.size),views:()=>Array.from((scene as any).actors.entries()).map(([id,a]:any)=>({id,art:a.art,action:a.action,frame:a.sprite.frame.name,flip:a.sprite.flipX,scale:a.sprite.scaleX,origin:[a.sprite.originX,a.sprite.originY],position:[a.sprite.x,a.sprite.y],playing:a.sprite.anims.isPlaying}))}});

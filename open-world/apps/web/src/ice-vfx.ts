import type Phaser from 'phaser';
import type {Vec} from '../../../packages/contracts/index.ts';
import {projectFx,type FxPoint} from './skill-fx-layout.ts';
import {seededNoise} from './vfx-geometry.ts';
import {polygon,line} from './vfx-drawing.ts';
import {vfxPalettes} from './vfx-profiles.ts';

export function iceFieldCrystals(center:Vec,radius:number,age:number,seed:number,reduced:boolean,burst:boolean){
 const count=reduced?6:burst?14:12,growth=reduced?1:.35+.65*(1-Math.exp(-Math.max(0,age)*18));
 return Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2+.17,r=radius*(.65+seededNoise(seed+i*19)*.2),ground=projectFx({x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r});return {ground,height:(burst?94:74)*(1+seededNoise(seed+i*37)*.5)*growth,width:(burst?27:22)*(1+seededNoise(seed+i*11)*.4),lean:(seededNoise(seed+i*7)-.5)*18};});
}

export function iceCrystalFaces(ground:FxPoint,height:number,width:number,lean=0){
 const tip={x:ground.x+lean,y:ground.y-height},waist={x:ground.x+lean*.28,y:ground.y-height*.32},left={x:ground.x-width*.5,y:ground.y-height*.26},right={x:ground.x+width*.5,y:ground.y-height*.23},base={x:ground.x,y:ground.y};
 return {outline:[tip,right,base,left],dark:[tip,left,base,waist],main:[tip,waist,base,right],light:[tip,{x:ground.x+width*.13,y:ground.y-height*.26},waist],ridge:[tip,waist,base]};
}

export function drawIceCrystal(g:Phaser.GameObjects.Graphics,ground:FxPoint,height:number,width:number,lean:number,alpha:number){
 const c=vfxPalettes.ice,f=iceCrystalFaces(ground,height,width,lean);polygon(g,f.outline,c.dark,alpha);polygon(g,f.dark,c.dark,alpha);polygon(g,f.main,c.main,alpha*.96);polygon(g,f.light,c.light,alpha*.95);line(g,f.outline,2.4,c.dark,alpha,true);line(g,f.ridge,1.8,c.light,alpha*.9);
}

export function drawIceMissile(g:Phaser.GameObjects.Graphics,tip:FxPoint,angle:number,length:number,width:number,alpha=1){
 const at=(x:number,y:number)=>({x:tip.x+Math.cos(angle)*x-Math.sin(angle)*y,y:tip.y+Math.sin(angle)*x+Math.cos(angle)*y}),c=vfxPalettes.ice,tail=at(-length,0),left=at(-length*.68,-width*.5),right=at(-length*.72,width*.5),ridge=at(-length*.55,0);
 polygon(g,[tip,left,tail,right],c.dark,alpha);polygon(g,[tip,left,tail,ridge],c.main,alpha);polygon(g,[tip,ridge,tail,right],c.light,alpha*.92);line(g,[tip,left,tail,right],2.6,c.dark,alpha,true);line(g,[tail,ridge,tip],2,c.light,alpha);
}

export function drawIceFracture(g:Phaser.GameObjects.Graphics,point:FxPoint,progress:number,seed:number,reduced:boolean){
 const count=reduced?4:9,t=Math.max(0,Math.min(1,progress)),c=vfxPalettes.ice;
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2+seed*.13,d=12+t*(35+seededNoise(seed+i*17)*25),p={x:point.x+Math.cos(a)*d,y:point.y+Math.sin(a)*d*.75-t*(1-t)*20},s=(1-t)*(9+seededNoise(seed+i*31)*7);polygon(g,[{x:p.x,y:p.y-s},{x:p.x+s*.65,y:p.y},{x:p.x,y:p.y+s*.45},{x:p.x-s*.5,y:p.y}],i%2?c.main:c.light,1-t);line(g,[point,p],1.8,c.main,(1-t)*.35);}
}

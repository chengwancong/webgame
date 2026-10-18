import Phaser from 'phaser';
import type {Reward} from '../../../packages/contracts/index.ts';
import {GroundLootRenderer,preloadGroundLoot} from './ground-loot-renderer.ts';
import {groundLootArt} from './ground-loot.ts';
import {resolvedToken} from './ui/tokens.ts';
import './ui-entry.css';
import {loadWorldFont} from './ui/world-text.ts';

// Read-only visual fixture: the production renderer and artwork, no login or rewards API.
const definitions=[['blade','苍风之刃','weapon'],['coat','守望轻甲','armor'],['omega-blade','方阵长剑','weapon'],['primal-blade','原初长剑','weapon'],['bow','穿云弓','weapon'],['charm','雷纹护符','accessory'],['core','余烬之心','core'],['shield','回响之核','core'],['omega-bow','方阵林地弓','weapon']] as const;
const rewards:Reward[]=definitions.map(([base,name,slot],i)=>{
 const x=160+i%5*240,y=270+Math.floor(i/5)*240;
 return {id:'fixture-'+i,source_id:'fixture-'+i,region:'loot-qa',position:{x:x/64+y/36,y:y/36-x/64},gear:{id:'fixture-'+i,base,name,slot,attack:0,armor:0,effect:'none',rank:0,locked:false,quality:'common',affixes:[]}};
});
document.body.style.cssText='margin:0;background:'+resolvedToken('Color.PanelInset');
const heading=document.createElement('p');heading.textContent='地面道具图标 · 正式渲染器只读验收';heading.style.cssText='position:absolute;left:24px;top:8px;color:'+resolvedToken('Color.TextPrimary')+';font-family:'+resolvedToken('Font.Family');document.body.append(heading);
const status=document.createElement('output');status.setAttribute('aria-label','资源状态');status.style.cssText=heading.style.cssText+';top:660px';document.body.append(status);
class LootReview extends Phaser.Scene{
  private loot?:GroundLootRenderer;
 preload(){preloadGroundLoot(this);this.load.image('grass','/art/environment/v2/meadow-ground.png');}
 create(){this.add.tileSprite(640,360,1280,720,'grass');this.loot=new GroundLootRenderer(this);this.loot.update(rewards,'loot-qa');Object.assign(window,{awLootInspect:()=>this.loot?.diagnostics()});}
 update(){this.loot?.update(rewards,'loot-qa');const d=this.loot?.diagnostics();if(d)status.textContent=`${d.items.filter(i=>i.loaded).length}/${rewards.length} 图标已加载 · 底框与底色：无 · ${d.errors.length} 资源错误`;}
}
void loadWorldFont().then(()=>new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:1280,height:720,scene:[LootReview],audio:{noAudio:true}}));
const resources=document.createElement('details');resources.style.cssText='position:absolute;right:24px;top:24px;color:'+resolvedToken('Color.TextPrimary');const summary=document.createElement('summary');summary.textContent='图标绑定';resources.append(summary);for(const r of rewards){const row=document.createElement('div');row.textContent=r.gear.name+'：'+groundLootArt(r);resources.append(row);}document.body.append(resources);

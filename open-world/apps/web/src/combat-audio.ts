import {vfxProfiles} from './vfx-profiles.ts';
import {productionRecipe} from './audio/production-recipes.ts';
import {wiredSamples} from './audio/sample-bank.ts';
import {preloadSamples} from './audio/sample-bank.ts';
import {cueRecipes} from './audio/sound-recipes.ts';
import {soundProfile} from './audio/sound-profiles.ts';
import {SoundMixer,soundPriorities} from './audio/mixer.ts';
export const soundPriority=(kind:string)=>['danger','bag-full'].includes(kind)?soundPriorities.warning:['shield-break','kill','multi-kill','block'].includes(kind)?soundPriorities.player:['hit','crit','hurt','shield-hit'].includes(kind)?soundPriorities.hit:soundPriorities.other;
export class CombatAudio{
 readonly mixer=new SoundMixer();private kills:number[]=[];private pendingKills=0;private pickupTick=-1;private epoch=0;
 unlock(skills:readonly string[]=[]){this.mixer.unlock(preloadSamples(skills));}
 play(kind:string,tick:number,volume:number){
 if(kind==='kill'){this.pendingKills++;const epoch=this.epoch;if(this.pendingKills===1)queueMicrotask(()=>{if(epoch!==this.epoch)return;const count=this.pendingKills;this.pendingKills=0;this.kills=this.kills.filter(t=>tick>=t&&tick-t<30);this.kills.push(...Array(count).fill(tick));const key=count>=3?'multi-kill':this.kills.length>3?'kill-light':'kill';this.mixer.play(cueRecipes[key],tick,volume,soundPriority(key));});return true;}
 if(kind==='loot'||kind.startsWith('pickup-')){if(this.pickupTick===tick)return false;this.pickupTick=tick;}
 return this.mixer.play(cueRecipes[kind]??cueRecipes.cast,tick,volume,soundPriority(kind));}

 skill(key:string,stage:'cast'|'release'|'impact'|'loop'|'tick'|'warning'|'end'|'flight',tick:number,volume:number,options:{pan?:number;visible?:boolean;monster?:boolean;thickness?:number;boss?:string}={}){if(/^(monster|boss|voice)\//.test(key)&&options.visible===false)return false;let recipe=soundProfile(key)?.[stage];if(!recipe)return false;if(key.startsWith('combo/')&&stage==='release'){const element=vfxProfiles[key]?.element,accent=({fire:'fire',ice:'ice',storm:'storm',shadow:'shadow',nature:'nature',steel:'steel',earth:'steel',arcane:'shadow',holy:'nature',blood:'shadow',poison:'nature'} as Record<string,string>)[element??'steel'];this.mixer.play(productionRecipe('accent/'+accent),tick,volume,soundPriorities.player,options);}if(stage==='warning'&&options.boss){recipe={...recipe,samples:wiredSamples('voice/'+options.boss,'warning')??recipe.samples};let seed=0;for(const char of options.boss)seed=(Math.imul(seed,31)+char.charCodeAt(0))>>>0;const tint=1+(seed%11)*.05;recipe={...recipe,id:recipe.id+'/'+options.boss,layers:recipe.layers.map((l,i)=>({...l,from:l.from*tint,to:(l.to??l.from)*tint,delay:(l.delay??0)+(i?seed%4*.018:0)}))};}return this.mixer.play(recipe,tick,volume,stage==='warning'?soundPriorities.warning:key.startsWith('boss/')?soundPriorities.boss:key.startsWith('monster/')?soundPriorities.monster:soundPriorities.player,{...options,monster:options.monster??(key.startsWith('monster/')||key.startsWith('voice/'))});}
 reset(){this.epoch++;this.pendingKills=0;this.kills=[];this.pickupTick=-1;this.mixer.reset();}
}

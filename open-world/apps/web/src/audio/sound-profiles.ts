import {warnMissingPresentation} from '../presentation-warnings.ts';
import {vfxProfiles,type SkillVfxProfile,type VfxElement} from '../vfx-profiles.ts';
import type {SoundRecipe,SoundLayer} from './sound-recipes.ts';
import {wiredSamples} from './sample-bank.ts';
import {statusKindSchema} from '../../../../packages/contracts/skill-mechanics.ts';
export type SoundProfile={key:string;cast:SoundRecipe;release:SoundRecipe;impact:SoundRecipe;loop?:SoundRecipe;tick?:SoundRecipe;warning?:SoundRecipe;end?:SoundRecipe;flight?:SoundRecipe};
const timbres:Record<VfxElement,[OscillatorType,number,BiquadFilterType,number]>={steel:['triangle',720,'bandpass',2200],fire:['sine',110,'lowpass',900],ice:['sine',1800,'highpass',4000],storm:['square',420,'highpass',3000],nature:['sine',480,'lowpass',900],arcane:['sine',620,'bandpass',1800],shadow:['sawtooth',130,'lowpass',600],earth:['triangle',75,'lowpass',400],holy:['sine',960,'highpass',2400],blood:['sine',65,'lowpass',650],poison:['sine',220,'lowpass',1200]};
const envelopes:Record<string,number>={slash:.11,spin:.3,dash:.16,projectile:.09,chain:.065,zone:.22,burst:.24,shield:.26,heal:.28,mark:.21,summon:.3,beam:.28};
export const soundProfiles:Record<string,SoundProfile>={};
export function deriveSoundProfile(p:SkillVfxProfile,ordinal:number):SoundProfile{
 const [type,hz,filter,noiseHz]=timbres[p.element],pitch=hz*Math.pow(2,(ordinal%29)/36),duration=(envelopes[p.family]??.12)*(1+ordinal*.006),quiet=1;
 const make=(stage:string):SoundRecipe=>{const impact=stage==='impact',weight=quiet*(stage==='loop'?.12:.65),span=duration*(impact?.72:stage==='release'?.65:1);
  const layers:SoundLayer[]=[{kind:'tone',type,from:pitch*(impact?.7:1),to:pitch*(p.family==='dash'?.5:['shield','heal'].includes(p.family)?1.5:impact?.45:1.22),duration:span,weight:weight*.55,...(['arcane','poison'].includes(p.element)?{lfo:{hz:6+ordinal%7,depth:12+ordinal}}:{})},{kind:'noise',filter,from:noiseHz*(1+ordinal*.017),duration:span*.65,weight:weight*.3,...(p.element==='poison'?{lfo:{hz:8,depth:.15}}:{})}];
  if(['nature','holy'].includes(p.element))for(const ratio of [1.25,1.5])layers.push({kind:'tone',type:'sine',from:pitch*ratio,to:pitch*ratio,duration:span,weight:weight*.13});
  if(p.element==='shadow')layers.push({kind:'tone',type:'sawtooth',from:pitch*1.025,to:pitch*.8,duration:span,weight:weight*.18});
  if(ordinal%3===1)layers.push({kind:'tone',type:'sine',from:pitch*2,to:pitch*1.7,duration:span*.45,weight:weight*.12,delay:span*.35});
  return {id:p.key+'/'+stage,layers,cooldown:stage==='loop'?30:p.family==='chain'?3:2,...(['mark','summon'].includes(p.family)?{echo:{delay:.065,weight:.15}}:{})};
 };return {key:p.key,cast:make('cast'),release:make('release'),impact:make('impact'),...(['zone','shield','beam'].includes(p.family)?{loop:make('loop')}:{})};
}
for(const [ordinal,p]of Object.values(vfxProfiles).entries())soundProfiles[p.key]=deriveSoundProfile(p,ordinal);
export const comboSoundBases:Record<string,string>={};
for(const p of Object.values(vfxProfiles).filter(p=>p.key.startsWith('combo/'))){
 const base=Object.values(vfxProfiles).find(b=>b.key.startsWith('player/')&&b.family===p.family&&b.element===p.element)??vfxProfiles['player/cut'];comboSoundBases[p.key]=base.key;
 const original=soundProfiles[base.key],accent=(r:SoundRecipe):SoundRecipe=>({...r,id:p.key+'/'+r.id.split('/').at(-1),layers:[...r.layers,{kind:'tone',type:'sine',from:2400,to:2900,duration:.065,weight:.18,delay:.035}]});soundProfiles[p.key]={key:p.key,cast:accent(original.cast),release:accent(original.release),impact:accent(original.impact),...(original.loop?{loop:accent(original.loop)}:{})};
}
const statusElements:Record<string,VfxElement>={burn:'fire',poison:'poison',bleed:'blood',shock:'storm',freeze:'ice',slow:'ice',petrify:'earth',regen:'nature',immunity:'holy',guardian:'holy',fear:'shadow',blind:'shadow',root:'nature'};
for(const [i,id]of statusKindSchema.options.entries()){const p={...vfxProfiles['system/damage'],key:'status/'+id,family:'mark' as const,element:statusElements[id]??'arcane'},profile=deriveSoundProfile(p,i+300);profile.cast.cooldown=30;profile.tick={...profile.impact,id:p.key+'/tick',cooldown:30};soundProfiles[p.key]=profile;}
for(const [i,p]of Object.values(soundProfiles).filter(p=>p.key.startsWith('boss/')).entries())p.warning={id:p.key+'/warning',cooldown:8,layers:[{kind:'tone',type:i%2?'triangle':'square',from:120+i*7,to:180+i*8,duration:.22,weight:.55},{kind:'tone',type:'sine',from:500+i*19,to:400+i*13,duration:.09,delay:.12,weight:.2}]};
for(const p of Object.values(soundProfiles)){if(!p.loop&&['zone','shield','beam'].includes(vfxProfiles[p.key]?.family))p.loop={...p.release,id:p.key+'/loop',cooldown:30};if(p.key.startsWith('status/'))p.end={...p.impact,id:p.key+'/end',cooldown:30};if(['projectile','beam','chain'].includes(vfxProfiles[p.key]?.family))p.flight={...p.release,id:p.key+'/flight'};}
// 已制作的采样覆盖合成配方；未加载完成或加载失败时仍走合成。
for(const p of Object.values(soundProfiles))for(const stage of ['cast','release','impact','loop','tick','warning','end','flight'] as const){const r=p[stage],files=wiredSamples(p.key,stage);if(r&&files)r.samples=files;if(r&&stage!=='warning'&&/^(monster|boss)\//.test(p.key))r.gain=.707;}
export function soundProfile(key:string){const p=soundProfiles[key];if(!p)warnMissingPresentation('sound',key);return p;}

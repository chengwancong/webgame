import {setEffect} from '../content/set-effects.ts';
import {effectAtoms} from '../content/effect-atoms.ts';
import {statLabels} from '../contracts/stats.ts';
import {affixDisplayValue} from '../contracts/affix-units.ts';
import {resolveAtomParts,overrideEffectRules} from './atom-parts.ts';
import type {EffectRule} from '../contracts/effects.ts';
const precise=(v:number)=>Math.round(v*1e6)/1e6;
function read(rule:EffectRule,path:string):number{return path.split('.').reduce((node:any,key)=>node?.[key],rule);}
export function scaledDescription(base:EffectRule,actual:EffectRule){
 const replacements=new Map<string,string>();
 for(const path of base.scale){const before=read(base,path),after=read(actual,path);if(before===after)continue;
  replacements.set(`${precise(before*100)}%`,`${precise(after*100)}%`);
  const multiplier=path==='action.ratio'&&base.action.type==='amplify';
  replacements.set(`×${precise(before+(multiplier?1:0))}`,`×${precise(after+(multiplier?1:0))}`);
 }
 // Replace original tokens once: an updated 20% must not be scaled again by a
 // different path, and +4% must not accidentally rewrite the tail of +24%.
 return base.description.replace(/(?<![\d.])\d+(?:\.\d+)?%|×\s*\d+(?:\.\d+)?/g,token=>replacements.get(token.replace(/\s/g,''))??token);
}
/** Display text uses the same selected tier and scaling paths as the server build. */
export function describeUnifiedBonuses(id:string,artStage:number):Record<string,string>{const set=setEffect(id);if(!set)return {};const scale=set.artStageScale[artStage-1];return Object.fromEntries(([['2',set.two],['4',set.four]] as const).map(([count,part])=>{
 const atoms=resolveAtomParts(part.atoms.map(a=>({...a,tier:a.tier*scale,source:set.id}))),rules=part.rules.flatMap(r=>overrideEffectRules([r],r.scale.length?[{target:r.id,mul:Object.fromEntries(r.scale.map(path=>[path,scale]))}]:[]));
 const text=[...part.stats.map(p=>`${statLabels[p.stat]} +${affixDisplayValue(p.stat,precise(p.value*scale))}`),...atoms.map(r=>{let text=scaledDescription(effectAtoms.find(a=>a.id===r.id)!,r);if(r.id==='atom-arrow-stack'&&!r.filter.tags?.length)text=text.replace('投射物命中','命中');if(r.id==='atom-shock'&&r.when.length)text='命中受控目标：'+text.replace(/^雷电命中[：:]?/, '');return text;}),...rules.map(r=>scaledDescription(part.rules.find(a=>a.id===r.id)!,r)),...part.conditional.map(c=>c.pool==='stat'?`生命低于30%时吸血提高 ${precise((c.value-1)*scale*100)}%`:`满足条件时伤害 +${precise(c.value*scale*100)}%`),...part.zones.map(z=>`${z.label}提高 ${precise((z.kind==='mult'?z.value-1:z.value)*scale*100)}%`),...(part.flags?.dotCrit?['持续伤害可暴击（暴击率减半）']:[])].join('；');return [count,text];}));}

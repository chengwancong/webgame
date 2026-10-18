import {describe,it,expect} from 'vitest';
import {tokenNames,tokenValues} from '../apps/web/src/ui/tokens.ts';
function luminance(hex:string){const rgb=hex.slice(1).match(/../g)!.slice(0,3).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
describe('UI semantic palette',()=>{
 for(const theme of ['dark','light'] as const)it(theme+' keeps ordinary text and actions readable across their actual surfaces',()=>{
  const t=tokenValues[theme];const pairs=[['Color.TextSecondary','Color.PanelInset'],['Color.Highlight','Color.PanelSelected'],['Color.Emphasis','Color.Panel'],['Color.TextPrimary','Color.Panel'],['Color.TextSecondary','Color.Panel'],['Color.TextPrimary','Color.PanelSecondary'],['Color.PrimaryText','Color.Primary'],['Color.PrimaryText','Color.PrimaryTop'],['Color.PrimaryText','Color.PrimaryHover'],['Color.SecondaryText','Color.Secondary'],['Color.SecondaryText','Color.SecondaryTop'],['Color.SecondaryText','Color.SecondaryHover'],['Color.Success','Color.Panel'],['Color.Warning','Color.Panel'],['Color.Danger','Color.Panel']] as const;
  for(const [fg,bg] of pairs)expect(contrast(t[fg],t[bg]),theme+' '+fg+' on '+bg).toBeGreaterThanOrEqual(4.5);
  expect(contrast(t['Color.Highlight'],t['Color.Panel']),'focus against panel').toBeGreaterThanOrEqual(3);
 });
 it('keeps every generated token name unique and both themes complete',()=>{
  const names=Object.values(tokenNames);expect(new Set(names).size).toBe(names.length);expect(Object.keys(tokenValues.dark)).toEqual(Object.keys(tokenValues.light));
  for(const theme of Object.values(tokenValues))for(const value of Object.values(theme)){expect(value).not.toContain('{Color.');expect(value.length).toBeGreaterThan(0);}
 });
 it('keeps ordinary quality names readable on panels and large bold detail names readable on inset surfaces',()=>{for(const theme of ['dark','light'] as const){const t=tokenValues[theme];for(const rarity of ['Common','Magic','Rare','Legendary'] as const)for(const bg of ['Color.Panel','Color.PanelRaised','Color.PanelInset'] as const)expect(contrast(t[`Color.Rarity.${rarity}`],t[bg]),`${theme} ${rarity} on ${bg}`).toBeGreaterThanOrEqual(bg==='Color.PanelInset'?3:4.5);}});
 it('keeps world text and ground quality names bright against their dedicated outline',()=>{
  const t=tokenValues.dark;expect(contrast(t['Color.World.Text'],t['Color.World.Ink'])).toBeGreaterThanOrEqual(4.5);
  for(const rarity of ['Common','Magic','Rare','Legendary'] as const)expect(contrast(t[`Color.World.Rarity.${rarity}`],t['Color.World.Ink'])).toBeGreaterThanOrEqual(4.5);
  expect(t['Color.Combat.DamageDealt']).toBe(t['Color.World.Text']);
  expect(t['Color.World.Text']).not.toBe(t['Color.TextPrimary']);
 });
});

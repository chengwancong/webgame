import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {ToastQueue,toastHtml,toastViewKey} from '../apps/web/src/ui/toast-queue.ts';
import {loginPanelHtml,createCharacterPanelHtml} from '../apps/web/src/ui/auth-panels.ts';
import {u5QaCases} from '../apps/web/src/u5-qa-samples.ts';
import {tokenValues} from '../apps/web/src/ui/tokens.ts';

describe('Direction A U5',()=>{
 it('renders an escaped icon ribbon without changing queue lifetime or sticky semantics',()=>{
  const q=new ToastQueue(),t=q.push('<b>已领取</b>',100,{kind:'loot',ttl:1000});
  const html=toastHtml(t,300);expect(html).toContain('data-icon="chest"');expect(html).toContain('&lt;b&gt;已领取&lt;/b&gt;');expect(html).toContain('--toast-lifetime:800ms');expect(html).not.toContain('<b>已领取</b>');
  expect(q.visible(1099)).toHaveLength(1);expect(q.visible(1100)).toHaveLength(0);
  const sticky=q.push('正在恢复',1100,{kind:'error',sticky:true});expect(toastHtml(sticky,20000)).toContain('is-sticky');expect(toastHtml(sticky,20000)).toContain('--toast-lifetime:0ms');expect(q.visible(20000)).toHaveLength(1);
 });
 it('renews the visual fade when a replacement keeps the same count and text',()=>{
  const q=new ToastQueue(),t=q.push('暂无目标',0,{replace:true});const before=toastViewKey(t);
  q.push('暂无目标',200,{replace:true});expect(t.count).toBe(1);expect(toastViewKey(t)).not.toBe(before);expect(toastHtml(t,200)).toContain('--toast-lifetime:3500ms');
 });
 it('uses one primary action in login, reconnect and naming without adding actions',()=>{
  for(const html of [loginPanelHtml(true),loginPanelHtml(false),loginPanelHtml(true,{ready:false,connecting:false,error:'断线',reload:false}),createCharacterPanelHtml()])expect(html.match(/class="[^"]*ui-button--primary/g)).toHaveLength(1);
  expect(loginPanelHtml(true)).toContain('class="title-mute ui-button ui-button--secondary ui-button--compact"');
 });
 it('keeps quiet skill icons, only a fixed bottom depth and the existing thin cooldown ring',()=>{
  const css=readFileSync(new URL('../apps/web/src/ui/hud.css',import.meta.url),'utf8');
  expect(css).toContain('0 var(--border-depth) 0 var(--color-secondary-edge),var(--shadow-skill)');
  expect(css).toContain('.skill-slot .cd::before');expect(css).not.toContain('slot-ready-sweep');expect(css).not.toContain('slot-deny-shake');
  expect(css).not.toMatch(/\.skill-slot[^{}]*img\s*\{[^}]*filter:/);expect(css).not.toMatch(/\.skill-slot[^{}]*\{[^}]*animation:/);
  expect(css).toContain('@media(prefers-reduced-motion:reduce){#toast .toast{animation:none}}');expect(css).toContain('[data-motion-reduced=true] #toast .toast{animation:none}');
 });
 it('retains HUD reservation bounds and makes all static cases render from registered content',()=>{
  const css=readFileSync(new URL('../apps/web/src/ui/hud.css',import.meta.url),'utf8');expect(css).toContain('#toast{position:fixed;top:256px;right:var(--space-3);width:360px;max-height:200px;');
  expect(u5QaCases.map(sample=>sample.id)).toEqual(expect.arrayContaining(['u5-loadout','u5-loadout-swap']));for(const sample of u5QaCases)expect(sample.render(),sample.id).not.toContain('undefined');
  expect(u5QaCases.find(sample=>sample.id==='u5-loadout')!.render()).toContain('class="character-panel has-loadout"');
  expect(u5QaCases.find(sample=>sample.id==='u5-loadout-swap')!.render()).toContain('class="character-panel is-swapping has-loadout"');
 });
 it('keeps text on toast and title controls above 4.5:1 contrast',()=>{
  const luminance=(hex:string)=>{const c=hex.replace('#','').match(/.{2}/g)!.slice(0,3).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  for(const t of Object.values(tokenValues))for(const [fg,bg] of [['Color.TextPrimary','Color.Panel'],['Color.SecondaryText','Color.Secondary'],['Color.SecondaryText','Color.PanelRaised']] as const){const a=luminance(t[fg]),b=luminance(t[bg]);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),fg+' / '+bg).toBeGreaterThanOrEqual(4.5);}
 });
});

import type {Plugin} from 'vite';
import {createRequire} from 'node:module';

export const uiLayerOrder=['tokens','legacy','components'] as const;
export const uiLayerPrelude=`@layer ${uiLayerOrder.join(', ')};`;

type CssNode={type:string;name?:string;params?:string;parent?:CssNode};
type CssRoot={walkAtRules(name:string,visit:(rule:CssNode)=>void):void};
// Reuse Vite's CSS parser. No browser runtime or additional dependency is needed.
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('vite/package.json'))('postcss') as {parse(css:string):CssRoot};

/** CSS cascade layer precedence follows first creation, even across stylesheet chunks. */
export function firstCreatedLayers(sheets:readonly string[]){
 const order:string[]=[];
 for(const sheet of sheets)postcss.parse(sheet).walkAtRules('layer',rule=>{
  let parent=rule.parent;
  while(parent){if(parent.type==='atrule'&&parent.name==='layer')return;parent=parent.parent;}
  for(const name of (rule.params??'').split(',').map(s=>s.trim().split('.')[0]).filter(Boolean))if(!order.includes(name))order.push(name);
 });
 return order;
}

export function assertUiLayerOrder(html:string,asset:(href:string)=>string|undefined,label:string){
 const sheets:string[]=[];
 // Inline declarations and external styles must be inspected in document order.
 for(const tag of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>|<link\b[^>]*>/gi)){
  if(tag[1]!==undefined){sheets.push(tag[1]);continue;}
  if(!/\brel\s*=\s*["']stylesheet["']/i.test(tag[0]))continue;
  const href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(tag[0])?.[1];
  if(!href)continue;
  const css=asset(href);if(css===undefined)throw Error(`Missing CSS for ${label}: ${href}`);
  sheets.push(css);
 }
 const order=firstCreatedLayers(sheets);
 if(uiLayerOrder.some((name,i)=>order[i]!==name))throw Error(`UI layer order in ${label}: ${order.join(' > ')}; expected ${uiLayerOrder.join(' > ')}`);
 return order;
}

/** Every game and review entry establishes the same precedence before extracted CSS. */
export function uiCascadeGuard():Plugin{
 return {
  name:'abyss-ui-cascade',enforce:'post',
  transformIndexHtml:{order:'pre',handler:()=>[{tag:'style',attrs:{'data-ui-layer-order':''},children:uiLayerPrelude,injectTo:'head-prepend'}]},
  generateBundle:{order:'post',handler(_options,bundle){
   const source=(value:string|Uint8Array)=>typeof value==='string'?value:new TextDecoder().decode(value);
   for(const item of Object.values(bundle)){
    if(item.type!=='asset'||!item.fileName.endsWith('.html'))continue;
    assertUiLayerOrder(source(item.source),href=>{const path=href.replace(/^\.\//,'').replace(/^\//,'');const css=bundle[path];return css?.type==='asset'?source(css.source):undefined;},item.fileName);
   }
  }},
 };
}

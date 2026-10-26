import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {TACTICAL_SCENE_ART,seaBackdropHtml,tacticalSceneHtml} from '../apps/web/src/tactical/scene-art.ts';
import type {TacticalEncounterView} from '../apps/web/src/tactical/contract.ts';

const view=(encounterId='scene-example',width=9,height=9)=>({encounterId,board:{width,height,cells:[]}} as unknown as TacticalEncounterView);

describe('tactical scenery from registered artwork',()=>{
 it('uses existing registered files without requiring generated output',()=>{
  const manifests=['starsea/scenes/manifest.json','open-world/five-islands/manifest.json','open-world/plane-kits/manifest.json']
   .map(path=>JSON.parse(readFileSync(new URL(`../apps/web/public/art/${path}`,import.meta.url),'utf8')));
  const runtimeFiles=new Set(manifests.flatMap(manifest=>manifest.assets.map((asset:{runtime?:{file?:string}})=>asset.runtime?.file)));
  for(const source of Object.values(TACTICAL_SCENE_ART)){
   expect(runtimeFiles.has(source),source).toBe(true);
   expect(existsSync(new URL(`../apps/web/public${source}`,import.meta.url)),source).toBe(true);
  }
 });

 it('crops the existing backdrop below the horizon without a new raster file',()=>{
  const html=seaBackdropHtml();
  expect(html).toContain('viewBox="0 510 1672 431"');
  expect(html).toContain('preserveAspectRatio="xMidYMid slice"');
  expect(html).toContain(TACTICAL_SCENE_ART.sea);
  expect(html).toContain('aria-hidden="true"');
 });

 it('is stable, decorative, and independent of combat state',()=>{
  const v=view(),before=structuredClone(v);
  const first=tacticalSceneHtml(v,72,42);
  expect(first).toBe(tacticalSceneHtml(v,72,42));
  expect(v).toEqual(before);
  expect(first).toContain(TACTICAL_SCENE_ART.soil);
  expect(first).toContain(TACTICAL_SCENE_ART.stone);
  expect(first).toContain(TACTICAL_SCENE_ART.sand);
  expect(first).not.toMatch(/<button|data-action=|role="grid"|tabindex=/);
  expect(first).toContain('maskUnits="userSpaceOnUse"');
  expect(first).toContain('--opacity-tactical-ground-wash');
  expect(first).toContain(TACTICAL_SCENE_ART.cliff);
  expect(first).toContain('data-scene-cliff-face="front"');
  expect(first).toContain('matrix(1 -0.44 0 1 0 0)');
 });

 it('uses overlapping registered cliff artwork behind the ground, clipped outside legal cells',()=>{
  const html=tacticalSceneHtml(view('cliff',9,9),72,42),w=648,h=378;
  expect(html.indexOf('data-scene-cliff-face="front"')).toBeLessThan(html.indexOf('<g clip-path="url(#tb-scene-'));
  expect([...html.matchAll(/data-scene-cliff-piece="front"/g)].length).toBeGreaterThan(2);
  for(const [tag,side,path] of html.matchAll(/<clipPath id="[^"]+-cliff-(front|left|right)"><path d="([^"]+)"\/>/g)){
   const points=[...path.matchAll(/(?:M|L)\s+(-?[\d.]+)\s+(-?[\d.]+)/g)].map(match=>[Number(match[1]),Number(match[2])]);
   expect(points.length,tag).toBeGreaterThan(2);
   expect(points.every(([x,y])=>side==='front'?y>=h:side==='left'?x<=0:x>=w),tag).toBe(true);
  }
 });

 it('uses scene-scoped defs and escapes the source identity',()=>{
  const html=tacticalSceneHtml(view('scene"><script>bad()</script>'),72,42);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.every(id=>/^tb-scene-[a-z0-9]+-/.test(id))).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  const references=[...html.matchAll(/url\(#([^\)]+)\)/g)].map(match=>match[1]);
  expect(references.every(reference=>ids.includes(reference))).toBe(true);
 });

 it.each([{width:9,height:7,cell:72,row:42},{width:9,height:9,cell:72,row:36},{width:10,height:10,cell:64,row:30}])(
  'keeps tall edge props outside a $width × $height playable board',({width,height,cell,row})=>{
   const html=tacticalSceneHtml(view('bounds',width,height),cell,row);
   const props=[...html.matchAll(/<image class="tb-scene-prop"[^>]+>/g)];
   expect(props.length).toBeGreaterThan(0);
   for(const [tag] of props){
    const value=(name:string)=>Number(tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1]);
    const x=value('x'),y=value('y'),w=value('width'),h=value('height');
    expect([x,y,w,h].every(Number.isFinite)).toBe(true);
    expect(x+w<=0||x>=width*cell||y+h<=0.001||y>=height*row,tag).toBe(true);
   }
  },
 );

 it('does not generate invalid geometry for an unavailable viewport',()=>{
  expect(tacticalSceneHtml(view(),0,30)).toBe('');
  expect(tacticalSceneHtml(view(),72,NaN)).toBe('');
 });
});

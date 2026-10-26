import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fitSceneBoard} from '../apps/web/src/tactical/board-layout.ts';

const source=JSON.parse(readFileSync(new URL('../packages/ui-tokens/tokens.json',import.meta.url),'utf8')) as {
 Size:Record<string,string>;Space:Record<string,string>;Border:Record<string,string>;
};
const css=readFileSync(new URL('../apps/web/src/tactical/tactical.css',import.meta.url),'utf8');
const marker='/* Compact combat HUD.';
const px=(value:string)=>{
 if(!/^\d+(?:\.\d+)?px$/.test(value))throw new Error(`Expected a pixel dimension token, received ${value}`);
 return Number.parseFloat(value);
};
const stage={width:px(source.Size.UiQaStageWidth),height:px(source.Size.UiQaStageHeight)};
const reserve={top:px(source.Size.TacticalBoardTop),bottom:px(source.Size.TacticalBoardBottom),side:px(source.Space['6'])};

describe('compact tactical HUD stage allocation',()=>{
 it('reserves separate header, battlefield and command regions inside the approved stage',()=>{
  expect(stage).toEqual({width:1280,height:720});
  const headerBottom=px(source.Space['4'])+px(source.Space['12'])+px(source.Space['2'])+px(source.Space['16']);
  const footerTop=stage.height-px(source.Space['4'])-px(source.Size.TacticalFooterHeight);
  expect(headerBottom).toBeLessThanOrEqual(reserve.top);
  expect(stage.height-reserve.bottom).toBeLessThanOrEqual(footerTop);
  expect(stage.height-reserve.top-reserve.bottom).toBeGreaterThan(0);
  // Five skills and the separate command area must fit without a hidden sidebar eating their width.
  const dockWidth=5*px(source.Size.TacticalSkillWidth)+6*px(source.Space['2']);
  const requiredWidth=dockWidth+px(source.Space['6'])+px(source.Size.TacticalCommandWidth);
  expect(requiredWidth).toBeLessThanOrEqual(stage.width-2*px(source.Space['4']));
  const playerHeight=px(source.Space['12'])+px(source.Space['2'])+px(source.Size.TacticalSkillHeight)+2*px(source.Space['2'])+2*px(source.Border.Width);
  expect(playerHeight).toBeLessThanOrEqual(px(source.Size.TacticalFooterHeight));
  expect(css).toContain('inset:var(--size-tactical-board-top) var(--size-tactical-scene-right) var(--size-tactical-board-bottom) var(--space-6)');
 });

 it.each([{width:9,height:7},{width:9,height:9},{width:10,height:10}])(
  'fits a $width × $height board without crossing the reserved HUD regions',board=>{
   const availableWidth=stage.width-reserve.side-px(source.Size.TacticalSceneRight);
   const availableHeight=stage.height-reserve.top-reserve.bottom;
   const layout=fitSceneBoard({board:{...board,cells:[]}},availableWidth,availableHeight);
   const cell=layout.cell;
   expect(cell).toBeGreaterThan(0);
   expect(Number.isInteger(cell)).toBe(true);
   expect(cell*board.width).toBeLessThanOrEqual(availableWidth);
   expect(layout.height).toBeLessThanOrEqual(availableHeight);
   expect(reserve.top+layout.height).toBeLessThanOrEqual(stage.height-reserve.bottom);
   // A shallow display projection keeps units large while fitting all logical rows.
   expect(layout.width).toBeGreaterThan(layout.height);
   expect(cell).toBeGreaterThan(50);
  },
 );

 it('uses defined token or stylesheet variables throughout the new compact HUD rules',()=>{
  const start=css.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const hudCss=css.slice(start);
  const defined=new Set<string>();
  const tokenName=(path:string[])=>'--'+path.join('.').replace(/([a-z0-9])([A-Z])/g,'$1-$2').replaceAll('.','-').toLowerCase();
  const visit=(node:unknown,path:string[]=[])=>{
   if(typeof node==='string'){
    defined.add(tokenName(path));return;
   }
   if(!node||typeof node!=='object')return;
   if('dark' in node&&typeof node.dark==='string'){
    defined.add(tokenName(path));return;
   }
   for(const [name,value] of Object.entries(node))if(!name.startsWith('$'))visit(value,[...path,name]);
  };
  visit(source);
  for(const match of css.matchAll(/[;{]\s*(--[\w-]+)\s*:/g))defined.add(match[1]);
  const used=[...new Set([...hudCss.matchAll(/var\(\s*(--[\w-]+)/g)].map(match=>match[1]))];
  expect(used.length).toBeGreaterThan(0);
  expect(used.filter(name=>!defined.has(name))).toEqual([]);
 });
});

/** Existing registered scene artwork only. Decorations never define cells or collision. */
import {esc} from '../ui-components.ts';
import type {TacticalEncounterView} from './contract.ts';

export const TACTICAL_SCENE_ART={
 sea:'/art/starsea/scenes/backdrops/sky.png',
 soil:'/art/open-world/five-islands/textures/ow-art-mist-ground-soil.png',
 stone:'/art/open-world/five-islands/textures/ow-art-mist-ground-stone.png',
 sand:'/art/open-world/five-islands/textures/ow-art-mist-ground-sand.png',
 cliff:'/art/open-world/five-islands/sprites/ow-art-mist-cliff-straight.png',
 bush:'/art/open-world/five-islands/sprites/ow-art-mist-bush.png',
 flowers:'/art/open-world/five-islands/sprites/ow-art-mist-flowers.png',
 cargo:'/art/open-world/five-islands/sprites/ow-art-mist-camp-cargo.png',
 flag:'/art/open-world/five-islands/sprites/ow-art-mist-camp-flag.png',
 rocks:'/art/open-world/five-islands/sprites/ow-art-mist-rocks-flat.png',
 pillar:'/art/open-world/plane-kits/props-contract/maze/pillar-362ac39bde66.png',
} as const;

const n=(value:number)=>Number(value.toFixed(3));
function sceneId(value:string):string{
 let hash=2166136261;
 for(const character of value)hash=Math.imul(hash^character.charCodeAt(0),16777619);
 return `tb-scene-${(hash>>>0).toString(36)}`;
}

/** Crop below the source's horizon; the parent stretches this SVG to its whole scene. */
export function seaBackdropHtml():string{
 return `<svg class="tb-sea-backdrop" xmlns="http://www.w3.org/2000/svg" viewBox="0 510 1672 431" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="${TACTICAL_SCENE_ART.sea}" x="0" y="0" width="1672" height="941"/></svg>`;
}

/** Coordinates are in the same cell/row geometry as the clickable board above this layer. */
export function tacticalSceneHtml(view:TacticalEncounterView,cell:number,rowHeight:number):string{
 if(!Number.isFinite(cell)||!Number.isFinite(rowHeight)||cell<=0||rowHeight<=0)return '';
 const w=view.board.width*cell,h=view.board.height*rowHeight;
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return '';
 const c=cell,r=rowHeight,mx=c*1.3,my=Math.max(r,c)*1.6;
 const id=sceneId(`${view.encounterId}:${view.board.width}:${view.board.height}`);
 const point=(x:number,y:number)=>`${n(x)} ${n(y)}`;
 // The whole rectangular playable board is inside this irregular apron. No cut-out hides a legal cell.
 const island=`M ${point(-c*.48,-r*.32)} L ${point(w*.14,-r*.54)} ${point(w*.33,-r*.3)} ${point(w*.57,-r*.49)} ${point(w*.81,-r*.31)} ${point(w+c*.42,-r*.43)} L ${point(w+c*.6,h*.16)} ${point(w+c*.42,h*.43)} ${point(w+c*.65,h*.72)} ${point(w+c*.4,h+r*.48)} L ${point(w*.79,h+r*.65)} ${point(w*.55,h+r*.44)} ${point(w*.29,h+r*.7)} ${point(-c*.45,h+r*.46)} L ${point(-c*.64,h*.72)} ${point(-c*.42,h*.41)} ${point(-c*.61,h*.15)} Z`;
 const soil=`M ${point(-c*.3,r*.12)} Q ${point(w*.2,-r*.4)} ${point(w*.46,0)} T ${point(w+c*.3,r*.2)} L ${point(w+c*.2,h*.6)} Q ${point(w*.83,h+r*.6)} ${point(w*.5,h+r*.2)} T ${point(-c*.2,h+r*.15)} Z`;
 const stone=`M ${point(w*.08,h*.12)} Q ${point(w*.29,-r*.1)} ${point(w*.62,h*.1)} T ${point(w*.91,h*.25)} L ${point(w*.83,h*.7)} Q ${point(w*.76,h*.94)} ${point(w*.46,h*.88)} L ${point(w*.12,h*.78)} Q ${point(-c*.1,h*.47)} ${point(w*.08,h*.12)} Z`;
 const front:[[number,number],...[number,number][]]=[[-c*.45,h+r*.46],[w*.29,h+r*.7],[w*.55,h+r*.44],[w*.79,h+r*.65],[w+c*.4,h+r*.48]];
 const edgeAt=(x:number)=>{
  for(let i=1;i<front.length;i++)if(x<=front[i][0]){
   const [ax,ay]=front[i-1],[bx,by]=front[i],k=Math.max(0,Math.min(1,(x-ax)/(bx-ax)));
   return ay+(by-ay)*k;
  }
  return front[front.length-1][1];
 };
 const polygon=(points:readonly [number,number][])=>`M ${points.map(([x,y])=>point(x,y)).join(' L ')} Z`;
 const frontFace=polygon([...front.map(([x,y])=>[x,y-r*.08] as [number,number]),...front.map(([x,y],i)=>[x,y+c*([.86,.98,.79,.95,.87][i])] as [number,number]).reverse()]);
 const rightEdge:[number,number][]=[[w+c*.42,-r*.43],[w+c*.6,h*.16],[w+c*.42,h*.43],[w+c*.65,h*.72],[w+c*.4,h+r*.48]];
 const leftEdge:[number,number][]=[[-c*.48,-r*.32],[-c*.61,h*.15],[-c*.42,h*.41],[-c*.64,h*.72],[-c*.45,h+r*.46]];
 const rightFace=polygon([...rightEdge,...rightEdge.map(([x,y])=>[x+c*.2,y+c*.55] as [number,number]).reverse()]);
 const leftFace=polygon([...leftEdge,...leftEdge.map(([x,y])=>[x-c*.15,y+c*.5] as [number,number]).reverse()]);
 const texture=(name:'soil'|'stone'|'sand',size:number)=>`<pattern id="${id}-${name}" width="${n(size)}" height="${n(size)}" patternUnits="userSpaceOnUse"><image href="${TACTICAL_SCENE_ART[name]}" width="${n(size)}" height="${n(size)}" preserveAspectRatio="none"/></pattern>`;
 const mask=(name:string,path:string)=>`<mask id="${id}-${name}" maskUnits="userSpaceOnUse" x="${n(-mx)}" y="${n(-my)}" width="${n(w+mx*2)}" height="${n(h+my*2)}" style="mask-type:alpha"><path d="${path}" fill="var(--color-panel-raised)" filter="url(#${id}-soft)"/></mask>`;
 const prop=(name:Exclude<keyof typeof TACTICAL_SCENE_ART,'sea'|'soil'|'stone'|'sand'|'cliff'>,x:number,foot:number,width:number,ratio:number)=>{
  const height=width*ratio;
  return `<image class="tb-scene-prop" data-scene-prop="${name}" href="${TACTICAL_SCENE_ART[name]}" x="${n(x-width/2)}" y="${n(foot-height)}" width="${n(width)}" height="${n(height)}" preserveAspectRatio="xMidYMax meet"/>`;
 };
 // Flatten the existing diagonal cliff's top plane, not its rock painting. Oversized,
 // overlapping pieces are cropped to the front/side faces; none can cover a playable cell.
 const cliffSpan=c*4.1,cliffScale=cliffSpan/528,cliffStep=cliffSpan*.68;
 const cliffPiece=(kind:string,x:number,edge:number,index:number)=>`<g data-scene-cliff-piece="${kind}" transform="translate(${point(x,edge-24*cliffScale)}) scale(${n(cliffScale)})"><image href="${TACTICAL_SCENE_ART.cliff}" width="528" height="358" transform="${index%2?'matrix(-1 -0.44 0 1 528 0)':'matrix(1 -0.44 0 1 0 0)'}"/></g>`;
 const frontPieces=Array.from({length:Math.ceil((w+c*1.2)/cliffStep)+1},(_,i)=>{
  const x=-c*.75+i*cliffStep;
  return cliffPiece('front',x,edgeAt(x+cliffSpan*.45),i);
 }).join('');
 const sideCount=Math.ceil((h+c)/ (c*.62))+1;
 const sidePieces=(side:'left'|'right')=>Array.from({length:sideCount},(_,i)=>cliffPiece(side,side==='right'?w-cliffSpan+c*1.2:-c*1.15,-r*.42+i*c*.62,i)).join('');
 const cliffBase=(path:string)=>`<path d="${path}" fill="url(#${id}-stone)"/><path d="${path}" fill="var(--color-text-primary)" style="opacity:var(--opacity-tactical-cliff-shade)"/>`;
 const cliffs=`${cliffBase(leftFace)}${cliffBase(rightFace)}${cliffBase(frontFace)}<g data-scene-cliff-face="left" clip-path="url(#${id}-cliff-left)">${sidePieces('left')}</g><g data-scene-cliff-face="right" clip-path="url(#${id}-cliff-right)">${sidePieces('right')}</g><g data-scene-cliff-face="front" clip-path="url(#${id}-cliff-front)">${frontPieces}</g>`;
 const rimProp=(name:'flowers'|'rocks',x:number,width:number,ratio:number)=>{
  const foot=edgeAt(x)-r*.02;
  return prop(name,x,foot,Math.min(width,(foot-h-r*.02)/ratio),ratio);
 };
 // Tall props sit outside the playable rectangle. The board's blocked cells retain their own art.
 const props=[
  prop('pillar',w*.07,-r*.06,c*.66,160/128),
  prop('flowers',w*.35,-r*.04,c*.58,379/528),
  prop('bush',w*.83,-r*.04,c*.82,418/528),
  prop('flag',w+c*.44,h*.35,c*.7,528/445),
  prop('cargo',-c*.5,h*.64,c*.8,482/528),
  prop('bush',-c*.47,h*.18,c*.8,418/528),
  prop('bush',w+c*.5,h*.8,c*.82,418/528),
  rimProp('flowers',w*.2,c*.5,379/528),
  rimProp('rocks',w*.73,c*.9,279/528),
 ].join('');
 return `<svg class="tb-scene-art" xmlns="http://www.w3.org/2000/svg" data-scene-encounter="${esc(view.encounterId)}" viewBox="${n(-mx)} ${n(-my)} ${n(w+mx*2)} ${n(h+my*2)}" width="${n(w+mx*2)}" height="${n(h+my*2)}" style="left:${n(-mx)}px;top:${n(-my)}px" aria-hidden="true" focusable="false">
<defs>${texture('sand',c*5)}${texture('soil',c*5)}${texture('stone',c*3.8)}
<clipPath id="${id}-land"><path d="${island}"/></clipPath>
<clipPath id="${id}-cliff-front"><path d="${frontFace}"/></clipPath><clipPath id="${id}-cliff-left"><path d="${leftFace}"/></clipPath><clipPath id="${id}-cliff-right"><path d="${rightFace}"/></clipPath>
<filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${n(c*.08)}"/></filter>
${mask('soil-mask',soil)}${mask('stone-mask',stone)}</defs>
${cliffs}
<g clip-path="url(#${id}-land)"><path d="${island}" fill="url(#${id}-sand)"/><rect x="${n(-mx)}" y="${n(-my)}" width="${n(w+mx*2)}" height="${n(h+my*2)}" fill="url(#${id}-soil)" mask="url(#${id}-soil-mask)"/><rect x="${n(-mx)}" y="${n(-my)}" width="${n(w+mx*2)}" height="${n(h+my*2)}" fill="url(#${id}-stone)" mask="url(#${id}-stone-mask)"/><path d="${island}" fill="var(--color-panel)" style="opacity:var(--opacity-tactical-ground-wash)"/></g>
${props}</svg>`;
}

/** Fixed 16:9 stage: the whole page (world canvas + DOM HUD) lays out at 1280×720 and scales uniformly to the window. */
export const STAGE={width:1280,height:720,maxRender:2} as const;

export type StageRect={left:number;top:number;right:number;bottom:number;width:number;height:number};
type StageLayout={scale:number;render:number;x:number;y:number};

let layout:StageLayout={scale:1,render:1,x:0,y:0};
const listeners=new Set<(layout:StageLayout)=>void>();

function measure():StageLayout{
 const w=window.innerWidth,h=window.innerHeight,scale=Math.min(w/STAGE.width,h/STAGE.height);
 // Canvas backing pixels per stage pixel: physical resolution, capped so 4K windows stay affordable.
 const render=Math.max(.5,Math.min(STAGE.maxRender,scale*(window.devicePixelRatio||1)));
 return {scale,render,x:Math.round((w-STAGE.width*scale)/2),y:Math.round((h-STAGE.height*scale)/2)};
}

/** 窗口小于 960×540 时文字会缩到难以阅读：给一条不挡操作、几秒后自行淡出的提示（UX-A08）。 */
const SMALL_SCALE=.75;let smallHint:HTMLElement|undefined;
function updateSmallHint(small:boolean){
 if(small&&!smallHint){smallHint=document.createElement('div');smallHint.id='stage-small-hint';smallHint.setAttribute('role','status');smallHint.textContent='窗口较小，文字会偏小；建议放大到 960×540 以上。';document.documentElement.appendChild(smallHint);}
 else if(!small&&smallHint){smallHint.remove();smallHint=undefined;}
}
function apply(){
 layout=measure();const root=document.documentElement.style;updateSmallHint(layout.scale<SMALL_SCALE);
 root.setProperty('--stage-scale',String(layout.scale));root.setProperty('--stage-x',layout.x+'px');root.setProperty('--stage-y',layout.y+'px');
 for(const listener of listeners)listener(layout);
}

/** Installs the stage on the game page. Must run before Phaser boots so its resize listener sees the new transform. */
export function mountStage(){
 document.documentElement.dataset.stage='';
 window.addEventListener('resize',apply);
 // Zoom or moving to another monitor changes devicePixelRatio without a resize on some browsers.
 const watchDpr=()=>matchMedia(`(resolution:${window.devicePixelRatio}dppx)`).addEventListener('change',()=>{apply();watchDpr();},{once:true});watchDpr();
 apply();
}

export const stageLayout=()=>layout;
export function onStageChange(listener:(layout:StageLayout)=>void){listeners.add(listener);return ()=>listeners.delete(listener);}

/** Converts a client (window) rectangle into stage pixels. */
export function stageBox(el:Element):StageRect;
export function stageBox(el:Element|null|undefined):StageRect|undefined;
export function stageBox(el:Element|null|undefined){
 if(!el)return undefined;const r=el.getBoundingClientRect(),s=layout.scale;
 const left=(r.left-layout.x)/s,top=(r.top-layout.y)/s,width=r.width/s,height=r.height/s;
 return {left,top,right:left+width,bottom:top+height,width,height};
}

/** Static, pre-blurred backdrop for the letterbox bars, captured once per map. */
export function setStageBackdrop(source:CanvasImageSource|undefined){
 const root=document.documentElement.style;
 if(!source){root.removeProperty('--stage-backdrop');return;}
 const canvas=document.createElement('canvas');canvas.width=192;canvas.height=108;const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.filter='blur(5px) saturate(.85) brightness(.82)';
 // Overdraw past the edges so the blur does not fade to transparent at the borders.
 ctx.drawImage(source,-12,-8,canvas.width+24,canvas.height+16);
 root.setProperty('--stage-backdrop',`url(${canvas.toDataURL('image/jpeg',.8)})`);
}

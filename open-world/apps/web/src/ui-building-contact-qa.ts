/** Read-only pointer boundary review, using the same fallback as the real scene. */
import {landmarkPointerFallback} from './landmark-pointer.ts';
import {project,unproject} from './iso.ts';
import {panelHeaderHtml} from './ui-components.ts';
const region={portal:{x:80,y:80},landmarks:[{name:'工坊入口',kind:'forge',x:20,y:20}]};
const origin=project(region.landmarks[0]);
const screen=(x:number,y:number)=>{const p=project({x,y});return{x:200+p.x-origin.x,y:110+p.y-origin.y};};
const result=(x:number,y:number)=>landmarkPointerFallback({x,y},region)?'点中地面入口标记。':'普通地面：继续点地移动，不打开工坊。';
function renderPointerQa(x:number,y:number){
 const point=screen(x,y);
 return `<section class="qa-primitives">${panelHeaderHtml('建筑点击 · 地面误触核对')}<p>虚线是原先误用的 4 格点击范围，中心十字为工坊服务点。现在整片地面均不触发工坊，可点图核对。</p><svg data-pointer-map xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220" width="400" height="220" role="img" aria-label="工坊地面误触核对"><ellipse cx="200" cy="110" rx="${4*32*Math.SQRT2}" ry="${4*18*Math.SQRT2}" fill="none" stroke="var(--color-danger)" stroke-width="2" stroke-dasharray="8 6"/><path d="M194 110h12M200 104v12" stroke="var(--color-text-secondary)" stroke-width="2"/><circle data-pointer-dot cx="${point.x}" cy="${point.y}" r="4" fill="var(--color-text-primary)"/></svg><p data-pointer-result role="status">${result(x,y)}</p><p>这里只核对真实地面判定函数。工坊主体由游戏的贴图像素命中处理；阻挡、人物碰撞半径和外观尺寸均保持原值。</p></section>`;
}
function mount(root:HTMLElement){
 const svg=root.querySelector<SVGSVGElement>('[data-pointer-map]')!;
 const click=(event:MouseEvent)=>{const matrix=svg.getScreenCTM();if(!matrix)return;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()),world=unproject({x:point.x-200+origin.x,y:point.y-110+origin.y});
  const dot=svg.querySelector('[data-pointer-dot]')!;dot.setAttribute('cx',String(point.x));dot.setAttribute('cy',String(point.y));root.querySelector('[data-pointer-result]')!.textContent=result(world.x,world.y);
 };
 svg.addEventListener('click',click);return()=>svg.removeEventListener('click',click);
}
export const buildingContactQaCases=[
 {id:'building-contact',label:'建筑点击 · 旁边空地',render:()=>renderPointerQa(22,20),mount},
 {id:'building-contact-service-ground',label:'建筑点击 · 门前空地',render:()=>renderPointerQa(20,20),mount},
];

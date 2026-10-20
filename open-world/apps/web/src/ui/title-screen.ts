// UX-A03：标题/登录/命名页的营地背景。标题光泽、版本角标、静音钮在 auth-panels.ts / auth.css；
// 这里只补“复用营地背景 + 缓慢飘移”：只用已登记的草地/石路/营地摆件，不新增位图。
// #modal 每次渲染都会被 innerHTML 重写，所以背景节点常驻、重写后原样接回，动画相位用负延迟保持连续。
const SPRITES:Array<{src:string;cls:string}>=[
 {src:'/art/open-world/sprites/ow-art-tree-wind.png',cls:'tbg-tree tbg-tree--l'},
 {src:'/art/open-world/sprites/ow-art-windmill.png',cls:'tbg-windmill'},
 {src:'/art/open-world/sprites/ow-art-tent.png',cls:'tbg-tent'},
 {src:'/art/open-world/sprites/ow-art-campfire.png',cls:'tbg-fire'},
 {src:'/art/open-world/sprites/ow-art-tree-oak.png',cls:'tbg-tree tbg-tree--r'},
 {src:'/art/open-world/sprites/ow-art-rocks.png',cls:'tbg-rocks'},
];

const phase=(period:number)=>`${-((performance.now()/1000)%period).toFixed(2)}s`;

export function installTitleScreen(host:HTMLElement){
 let bg:HTMLElement|null=null;
 const build=()=>{
  const el=document.createElement('div');el.className='title-bg';el.setAttribute('aria-hidden','true');
  el.innerHTML='<div class="title-bg__ground"></div><div class="title-bg__camp"></div><div class="title-bg__far"></div><div class="title-bg__near"></div><div class="title-bg__light"></div>';
  const far=el.querySelector('.title-bg__far')!,near=el.querySelector('.title-bg__near')!;
  for(const s of SPRITES){const img=new Image();img.alt='';img.decoding='async';img.draggable=false;img.src=s.src;img.className=s.cls;(/tree|rocks/.test(s.cls)?near:far).append(img);}
  return el;
 };
 const enhance=()=>{
  if(!host.classList.contains('open')||host.classList.contains('is-closing')||!host.querySelector('.ui-auth')){delete host.dataset.title;return;}
  host.dataset.title='';
  if(!bg)bg=build();
  /* 漂移是往返动画，周期 = 2 × 时长（Motion.TitleDrift 56s）。 */
  if(bg.parentElement!==host||host.firstElementChild!==bg){host.prepend(bg);bg.style.setProperty('--tbg-phase',phase(112));}
 };
 new MutationObserver(enhance).observe(host,{childList:true,attributes:true,attributeFilter:['class']});enhance();
}

import './ui-entry.css';
import './ui/legacy-showcase.css';
document.body.classList.add('component-showcase');
import {art} from './ui-assets.ts';
import {itemSlot, statusBar} from './ui-components.ts';

const root = document.querySelector('#showcase')!;
const skills = ['cut','whirl','bolt','frost','ward','ember','chain','mend','nova','rush','cleave','lance'];
const gears = ['blade','bow','coat','charm','core','shield'];
const ratios = [0, 0.01, 0.5, 0.99, 1];

const grounds = [
  ['black', '纯黑'],
  ['white', '纯白'],
  ['gray', '中灰'],
  ['navy', '深蓝'],
  ['scene', '实际游戏场景'],
] as const;

root.innerHTML = `
<header class="show-head"><h1>深渊行者界面组件</h1><p>与游戏共用资源解析和样式。面板、按钮、槽位、进度条由样式绘制，图标来自正式资源。</p></header>
${grounds.map(([id, name]) => `<section class="ground ground-${id}" ${id==='scene'?`style="background-image:linear-gradient(#0b1f3b55,#0b1f3b55),url(${art('sample-world')});background-size:cover;background-position:center"`: ''} aria-label="${name}"><h2>${name}</h2>${sample(id === 'navy')}</section>`).join('')}
<section class="ground ground-navy" aria-label="状态覆盖"><h2>状态</h2>
  <div class="row">${['加载','禁用','选中','锁定','已装备','冷却','错误'].map(name => itemSlot({action:'noop', id:name, label:name, src:art('skill-cut'), pressed:name==='选中', disabled:name==='禁用', loading:name==='加载', className:name==='锁定'?'is-lock':name==='已装备'?'is-worn':name==='冷却'?'is-cd':name==='错误'?'is-error':name==='禁用'?'is-off':'', extra:name==='已装备'?'<span class="worn"></span>':name==='冷却'?'<span class="cd num">1.2</span>':name==='锁定'?'<span class="lock">锁</span>':''})).join('')}</div>
  <p class="long">这是一段故意写得很长的说明，用来确认窄宽度下文字换行而不是把整页文字缩小到看不清。资源名称、比较结果和操作条件都走真实文本。</p>
  <div class="bars">${ratios.map(n => statusBar(n < 0.3 ? 'hp' : 'mp', n, `${Math.round(n * 100)}%`)).join('')}</div>
  <label class="checkline"><input id="demo-check" type="checkbox" role="checkbox" aria-checked="false" aria-label="显示技能冷却">显示技能冷却</label>
  <div class="slot-grid" id="keygrid" role="grid" aria-label="背包格">${Array.from({length:12}, (_, i) => itemSlot({action:'grid', id:String(i), label:`格子${i + 1}`, src: i < gears.length ? art('gear-' + gears[i]) : undefined, className:'cell'})).join('')}</div>
  <p><button type="button" class="primary" id="tip-host" data-tip="提示文字应留在视口内">悬停看提示</button> <button type="button" disabled>禁用按钮</button> <button type="button" class="danger">分解</button></p>
  <p class="inline-error" role="alert">这是一条行内错误，不依赖深色字配深色底。</p>
</section>`;

function sample(compact: boolean) {
  return `<div class="panel show-panel">${compact ? '' : '<div class="panel-head"><h2>行囊</h2><button class="close" type="button" aria-label="关闭">×</button></div>'}
    <div class="row">
      <button type="button" class="primary">装备</button>
      <button type="button">强化</button>
      <button type="button" class="danger">分解</button>
    </div>
    <div class="row">${skills.slice(0, 4).map(id => `<img class="icon" src="${art('skill-' + id)}" alt="">`).join('')}</div>
  </div>`;
}

const box = document.querySelector('#demo-check') as HTMLInputElement;
box.addEventListener('change', () => {box.setAttribute('aria-checked', String(box.checked));document.querySelectorAll('#keygrid .slot').forEach(el=>{el.classList.toggle('is-cd',box.checked);el.querySelector('.cd')?.remove();if(box.checked)el.insertAdjacentHTML('beforeend','<span class="cd num">1.2</span>');});});

const grid = document.querySelector('#keygrid')!;
grid.addEventListener('click', event=>{const slot=(event.target as HTMLElement).closest('button');if(!slot)return;grid.querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===slot)));});
grid.addEventListener('keydown', event => {
  const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>('button'));
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  const cols = 6;
  const move: Record<string, number> = {ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols};
  const delta = move[(event as KeyboardEvent).key];
  if (delta === undefined) return;
  event.preventDefault();
  buttons[(index + delta + buttons.length) % buttons.length]?.focus();
});

const tip = document.createElement('div');
tip.id = 'tooltip';
tip.hidden = true;
document.body.append(tip);
const host = document.querySelector('#tip-host') as HTMLElement;
const place = () => {
  tip.hidden = false;tip.style.display='block';
  tip.textContent = host.dataset.tip ?? '';
  const r = host.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  let x = r.left, y = r.top - tr.height - 8;
  if (y < 6) y = r.bottom + 8;
  x = Math.max(6, Math.min(window.innerWidth - tr.width - 6, x));
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
};
host.addEventListener('mouseenter', place);
host.addEventListener('focus', place);
host.addEventListener('mouseleave', () => { tip.hidden = true;tip.style.display='none'; });
host.addEventListener('blur', () => { tip.hidden = true;tip.style.display='none'; });

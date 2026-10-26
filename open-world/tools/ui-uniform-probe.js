// 统一规范 DOM 测量（docs/ui-uniform-spec-20261025.md）。在内置浏览器（非无头）里对当前界面执行，返回 JSON。
// 用法：整段执行后得到 window.uiProbe(rootSel?)，对当前界面调用返回 JSON。
window.uiProbe=(rootSel)=>{
 rootSel=rootSel||'.ui-confirm-overlay, #modal.open, #modal';
 const root=document.querySelector(rootSel)||document.body;
 const vis=e=>{const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||+s.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>1&&r.height>1;};
 const desc=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.classList.length?'.'+[...e.classList].slice(0,2).join('.'):'');
 const stage=document.querySelector('#qa-stage,#stage,.stage,#app')||document.body;const sr=stage.getBoundingClientRect();
 const scale=sr.width/1280||1;
 const out={root:desc(root),scale:+scale.toFixed(3),issues:[]};
 const add=(id,msg,el)=>out.issues.push({id,msg,el:el?desc(el):undefined});
 // UX-01 primary
 const prim=[...root.querySelectorAll('.ui-button--primary,button.primary')].filter(vis);
 out.primary=prim.length;if(prim.length>1)add('UX-01','可见主按钮 '+prim.length+'：'+prim.map(b=>b.textContent.trim().slice(0,8)).join(' / '));
 // UI-04 close buttons
 const closes=[...root.querySelectorAll('[data-action$="close"],.ui-panel-head__close,[aria-label^="关闭"]')].filter(vis);
 out.closes=closes.length;if(closes.length>1)add('UI-04','可见关闭钮 '+closes.length+'：'+closes.map(c=>c.getAttribute('data-action')||c.getAttribute('aria-label')).join(' / '));
 // UX-02 panel in stage
 for(const p of [...root.querySelectorAll('.panel,.ui-panel,[role=dialog]')].filter(vis).slice(0,6)){const r=p.getBoundingClientRect();if(r.left<sr.left-2||r.top<sr.top-2||r.right>sr.right+2||r.bottom>sr.bottom+2)add('UX-02','面板超出舞台 '+[r.left-sr.left,r.top-sr.top,r.right-sr.right,r.bottom-sr.bottom].map(v=>Math.round(v/scale)).join(','),p);}
 // UI-03 raw buttons
 const raw=[...root.querySelectorAll('button')].filter(b=>vis(b)&&!b.closest('[data-ui]')&&!b.dataset.ui&&!b.matches('.ui-button,.ui-help')&&!b.className.match(/slot|cell|node|card|item|tab|menu|skill|chip|tile|row|pill|swatch|ring|dot/i));
 if(raw.length)add('UI-03','非公共按钮 '+raw.length+'：'+raw.slice(0,5).map(b=>desc(b)+'「'+b.textContent.trim().slice(0,6)+'」').join(' '));
 // UI-02 font sizes + UE-06 clipping + UX-08 placeholder text
 let total=0,small=0,minFs=99,minEl;const clipped=[];const bad=[];
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
 const seen=new Set();
 while((n=walker.nextNode())){const t=n.textContent.trim();if(!t)continue;const e=n.parentElement;if(!e||seen.has(e)||!vis(e))continue;seen.add(e);
  const s=getComputedStyle(e);const fs=parseFloat(s.fontSize)/scale;total+=t.length;if(fs<12.9)small+=t.length;if(fs<minFs&&t.length>1&&!e.closest('.a1-menu,.hud-menu,[data-menu]')){minFs=fs;minEl=e;}
  if(/\b(TODO|undefined|NaN|null)\b|\[object|（\s*）|\(\s*\)/.test(t))bad.push(t.slice(0,20));
  if(e.scrollWidth>e.clientWidth+2&&s.overflow!=='visible'&&s.textOverflow!=='ellipsis'&&e.children.length===0)clipped.push(desc(e)+'「'+t.slice(0,10)+'」');}
 out.minFont=+minFs.toFixed(1);out.smallRatio=total?+(small/total).toFixed(2):0;
 if(minFs<11.9)add('UI-02','最小字号 '+minFs.toFixed(1)+'px「'+(minEl?.textContent.trim().slice(0,10))+'」',minEl);
 if(out.smallRatio>0.35)add('UI-02','≤13px 文字占比 '+out.smallRatio);
 if(clipped.length)add('UE-06','文字被裁切无省略号 '+clipped.length+'：'+clipped.slice(0,4).join(' '));
 if(bad.length)add('UX-08','占位/异常文本：'+bad.slice(0,4).join(' | '));
 // UX-03 disabled without reason
 const dis=[...root.querySelectorAll('button[disabled]')].filter(b=>vis(b)&&b.getAttribute('aria-busy')!=='true');
 const noReason=dis.filter(b=>b.textContent.replace(/正在准备…/,'').trim().length>1&&!b.title&&!b.getAttribute('aria-describedby')&&!/缺|需|未|已|满|不足|锁|等级|Lv|解锁|上限|冷却|中…/.test((b.textContent+' '+(b.parentElement?.textContent||'')).slice(0,200)));
 if(noReason.length)add('UX-03','禁用按钮无原因 '+noReason.length+'：'+noReason.slice(0,4).map(b=>'「'+b.textContent.trim().slice(0,8)+'」').join(' '));
 // UX-06 「前往/去」纯文字无按钮
 const goTexts=[...root.querySelectorAll('p,span,small,div')].filter(e=>vis(e)&&e.children.length===0&&/^(请)?(前往|去).{1,8}(强化|制作|查看|领取|激活)?/.test(e.textContent.trim())&&!e.closest('button,a,[data-action]'));
 if(goTexts.length)add('UX-06','导航文字无按钮：'+goTexts.slice(0,3).map(e=>'「'+e.textContent.trim().slice(0,14)+'」').join(' '));
 // 页签
 out.tabs=[...root.querySelectorAll('[role=tab]')].filter(vis).map(t=>t.textContent.trim().slice(0,6));
 out.title=(root.querySelector('h1,h2,.ui-panel-head__title')?.textContent||'').trim().slice(0,20);
 return out;
};

import {chromium} from 'playwright';
import {Pool} from 'pg';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root} from './runtime.mjs';

const out=join(root,'../.design/compact-menu-labels-20261003'),base='http://127.0.0.1:8611';await mkdir(out,{recursive:true});
const port=Number((await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split(/\r?\n/)[3]);
const pool=new Pool({connectionString:`postgresql://aw_world@127.0.0.1:${port}/postgres`});let browser;
const compactBase="#sysbar .entry{padding:0;gap:0;height:64px;min-height:64px;width:64px;min-width:64px;border:1px solid var(--color-border);border-radius:16px;background:var(--color-panel);color:var(--color-text-primary);text-shadow:none;box-shadow:var(--shadow-hud-menu);overflow:hidden}#sysbar .entry:hover{background:var(--color-panel-hover);color:var(--color-text-primary)}#sysbar .entry-orb{position:absolute;inset:0;display:block;width:100%;height:100%;padding:5px 6px 7px;border:0;background:none;box-shadow:none}#sysbar .entry:hover .entry-orb{background:none;box-shadow:none}#sysbar .entry-name{position:absolute;bottom:3px;left:3px;right:3px;z-index:3;font-size:12px;line-height:17px;font-weight:600;text-align:center;letter-spacing:0;text-shadow:none;pointer-events:none}#sysbar .entry[aria-expanded=true]{border-color:var(--color-highlight);background:var(--color-panel-selected)}";
const variants=[
 {id:'a1-printed',name:'A1 · 直接印字',note:'64×64方形。名字轻叠在图标下缘，用薄奶白描边保留可读性。',css:compactBase+'#sysbar .entry-name{paint-order:stroke fill;-webkit-text-stroke:2px var(--color-panel)}'},
 {id:'a2-soft-wash',name:'A2 · 柔和衬字',note:'推荐。64×64方形，底部少量奶白淡化，文字清楚且不另加标签框。',css:compactBase+'#sysbar .entry:after{content:"";position:absolute;left:0;right:0;bottom:0;height:23px;z-index:2;pointer-events:none;background:linear-gradient(transparent,color-mix(in srgb,var(--color-panel) 96%,transparent) 65%)}#sysbar .entry-name{font-size:13px}'},
 {id:'a3-corner-mark',name:'A3 · 角落印字',note:'64×64方形。文字靠右下角，保留图标的主要轮廓。',css:compactBase+'#sysbar .entry-name{left:auto;right:4px;bottom:3px;width:32px;paint-order:stroke fill;-webkit-text-stroke:2px var(--color-panel)}'}
];
try{
 const row=(await pool.query("SELECT username FROM ow_accounts WHERE username LIKE 'ivory_%' ORDER BY username LIMIT 1")).rows[0];if(!row)throw Error('Ivory QA fixture required.');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 await page.goto(base);await page.locator('#username').fill(row.username);await page.locator('[data-action=login]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn||document.querySelector('[data-action=takeover]'));if(await page.locator('[data-action=takeover]').count())await page.locator('[data-action=takeover]').click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel===''&&document.querySelectorAll('#skillbar .skill-slot').length>0);await page.mouse.move(500,400);
 for(const v of variants){const style=await page.addStyleTag({content:'#sysbar *{transition:none!important}'+v.css});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.locator('#sysbar').screenshot({path:join(out,v.id+'.png')});if(v.id==='a2-soft-wash')await page.screenshot({path:join(out,'a2-fullscreen.png')});await style.evaluate(e=>e.remove());}
 const cards=variants.map(v=>`<article><div><h2>${v.name}</h2><p>${v.note}</p></div><img src="${v.id}.png" alt="${v.name}"></article>`).join('');
 await writeFile(join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#f3f0e8;color:#293940;font:14px/1.6 "Microsoft YaHei",sans-serif}h1{font-size:24px;margin:0}body>p{margin:6px 0 24px;color:#65747c}article{display:grid;grid-template-columns:280px 424px;align-items:center;gap:24px;background:white;border:1px solid #e2dac8;border-radius:14px;padding:20px;margin-bottom:16px}h2{font-size:18px;margin:0 0 8px}article p{margin:0;color:#65747c}img{display:block;width:424px;max-width:100%;border-radius:6px}</style><h1>方形按钮：文字轻叠在图标上</h1><p>延续奶白浅金。三套均为64×64方形，较上轮A的64×88更紧凑；仅为示意预览。</p>${cards}</html>`);
 const gallery=await context.newPage();await gallery.setViewportSize({width:840,height:630});await gallery.goto('file:///'+join(out,'index.html').replaceAll('\\','/'));await gallery.screenshot({path:join(out,'comparison.png'),fullPage:true});console.log(JSON.stringify({out,previewOnly:true}));
}finally{await browser?.close();await pool.end();}

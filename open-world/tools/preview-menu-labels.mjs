import {chromium} from 'playwright';
import {Pool} from 'pg';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root} from './runtime.mjs';

const out=join(root,'../.design/menu-labels-20261003'),base='http://127.0.0.1:8611';await mkdir(out,{recursive:true});
const port=Number((await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split(/\r?\n/)[3]);
const pool=new Pool({connectionString:`postgresql://aw_world@127.0.0.1:${port}/postgres`});let browser;
const variants=[
 {id:'a-inside',name:'A · 文字放进奶白底板',note:'浅底＋深色字，无阴影。最适合当前奶白浅金。',css:'#sysbar .entry{padding:4px;gap:2px;border-color:var(--color-border);background:var(--color-panel);color:var(--color-text-primary);text-shadow:none;box-shadow:var(--shadow-hud-menu)}#sysbar .entry-orb{width:56px;height:56px;flex-basis:56px;background:none;border:0;box-shadow:none}#sysbar .entry-name{font-weight:500;text-shadow:none}'},
 {id:'b-outside',name:'B · 文字留在场景上',note:'暖白字＋细深色边，无模糊光晕。图标保持原大小。',css:'#sysbar .entry{color:var(--color-world-text);text-shadow:none}#sysbar .entry-name{font-weight:600;paint-order:stroke fill;-webkit-text-stroke:1px var(--color-world-ink);text-shadow:0 1px 0 var(--color-world-ink)}'},
 {id:'c-icons',name:'C · 只常驻图标',note:'名称通过悬停提示显示，画面更简洁。',css:'#sysbar .entry{height:64px;min-height:64px;gap:0}#sysbar .entry-name{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}'}
];
try{
 const row=(await pool.query("SELECT username FROM ow_accounts WHERE username LIKE 'ivory_%' ORDER BY username LIMIT 1")).rows[0];if(!row)throw Error('Ivory QA fixture required.');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 await page.goto(base);await page.locator('#username').fill(row.username);await page.locator('[data-action=login]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn||document.querySelector('[data-action=takeover]'));if(await page.locator('[data-action=takeover]').count())await page.locator('[data-action=takeover]').click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel===''&&document.querySelectorAll('#skillbar .skill-slot').length>0);await page.mouse.move(500,400);
 for(const v of variants){const style=await page.addStyleTag({content:'#sysbar *{transition:none!important}'+v.css});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.locator('#sysbar').screenshot({path:join(out,v.id+'.png')});await style.evaluate(e=>e.remove());}
 const cards=variants.map(v=>`<article><div><h2>${v.name}</h2><p>${v.note}</p></div><img src="${v.id}.png" alt="${v.name}"></article>`).join('');
 await writeFile(join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#f3f0e8;color:#293940;font:14px/1.6 "Microsoft YaHei",sans-serif}h1{font-size:24px;margin:0}body>p{margin:6px 0 24px;color:#65747c}article{display:grid;grid-template-columns:280px 424px;align-items:center;gap:24px;background:white;border:1px solid #e2dac8;border-radius:14px;padding:20px;margin-bottom:16px}h2{font-size:18px;margin:0 0 8px}article p{margin:0;color:#65747c}img{display:block;width:424px;max-width:100%;border-radius:6px}</style><h1>菜单文字处理：本项目的三个小样</h1><p>借鉴其他游戏的文字组织方式，均为本项目预览；不是其他游戏原图。</p>${cards}</html>`);
 const gallery=await context.newPage({viewport:{width:820,height:620}});await gallery.goto('file:///'+join(out,'index.html').replaceAll('\\','/'));await gallery.screenshot({path:join(out,'comparison.png'),fullPage:true});console.log(JSON.stringify({out,previewOnly:true}));
}finally{await browser?.close();await pool.end();}

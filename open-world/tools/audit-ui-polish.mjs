import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const tag=process.argv[2]||'before';
const out=resolve(import.meta.dirname,'../../.design/ui-polish-20261004',tag);await mkdir(out,{recursive:true});
const sizes=(process.argv[3]||'1280x720').split(',').map(s=>s.split('x').map(Number));
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={};
for(const [W,H] of sizes){
const page=await browser.newPage({viewport:{width:W,height:H}});
await page.goto('http://127.0.0.1:8612/');
await page.locator('#username').fill('uipolish_'+Date.now().toString(36));await page.locator('[data-action=login]').click();await page.locator('#hero-name').waitFor();await page.locator('#hero-name').fill('界面审计');await page.locator('[data-action=create]').click();
await page.waitForFunction(()=>window.awInspect?.().loggedIn,null,{timeout:30000});await page.waitForTimeout(2500);
const audit=()=>page.evaluate(()=>{
 const issues=[];const leaves=[];
 const vis=e=>{const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||+s.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
 const desc=e=>{let s=e.tagName.toLowerCase();if(e.id)s+='#'+e.id;if(e.classList.length)s+='.'+[...e.classList].slice(0,3).join('.');return s;};
 const path=e=>{const p=[];let c=e;for(let i=0;i<3&&c;i++){p.unshift(desc(c));c=c.parentElement;}return p.join('>');};
 const scope=document.querySelector('#modal.open')?'#modal *, #toast *':'#hud *, #modal *, #toast *';
 for(const e of document.querySelectorAll(scope)){
  if(!vis(e))continue;{const r0=e.getBoundingClientRect();if(r0.width<=2||r0.height<=2)continue;}
  const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  if(!own)continue;
  const s=getComputedStyle(e),fs=parseFloat(s.fontSize);
  const r=e.getBoundingClientRect();
  // clipped check
  let anc=e,hiddenBy=null;while(anc&&anc!==document.body){const as=getComputedStyle(anc);if(as.overflow!=='visible'){const ar=anc.getBoundingClientRect();if(r.bottom<ar.top||r.top>ar.bottom||r.right<ar.left||r.left>ar.right){hiddenBy=anc;break;}}anc=anc.parentElement;}
  if(hiddenBy)continue;
  const text=e.textContent.trim().slice(0,30);
  if(fs<12)issues.push({type:'small-font',fs,text,el:path(e)});
  if((e.scrollWidth>e.clientWidth+1&&['hidden','clip'].includes(s.overflowX))||s.textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth+1)issues.push({type:'truncated',text,el:path(e),sw:e.scrollWidth,cw:e.clientWidth});
  if(s.transform!=='none'){const m=new DOMMatrix(s.transform);if(Math.abs(m.a-1)>.001||Math.abs(m.d-1)>.001)issues.push({type:'scaled-text',text,el:path(e),t:s.transform});}
  if(r.right>innerWidth+1||r.bottom>innerHeight+1||r.left<-1||r.top<-1)issues.push({type:'offscreen',text,el:path(e),r:[r.x,r.y,r.width,r.height].map(Math.round)});
  if(parseFloat(s.webkitTextStrokeWidth)>0||s.textShadow!=='none')issues.push({type:'text-effect',text,el:path(e),shadow:s.textShadow,stroke:s.webkitTextStrokeWidth,fs});
  // text range rect
  const range=document.createRange();range.selectNodeContents(e);const rr=range.getBoundingClientRect();
  leaves.push({e,r:rr,text,fs,lh:s.lineHeight});
 }
 for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++){const a=leaves[i],b=leaves[j];if(a.e.contains(b.e)||b.e.contains(a.e))continue;const ox=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left),oy=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);if(ox>2&&oy>3)issues.push({type:'overlap',a:a.text,b:b.text,ea:path(a.e),eb:path(b.e),ox:Math.round(ox),oy:Math.round(oy)});}
 const fonts=[...new Set(leaves.map(l=>l.fs))].sort((a,b)=>a-b);
 return {issues,fonts,count:leaves.length};
});
const shot=async(n)=>{await page.evaluate(()=>document.fonts.ready);await page.mouse.move(1,1);await page.waitForTimeout(400);await page.screenshot({path:resolve(out,`${n}-${W}x${H}.png`)});report[`${n}-${W}x${H}`]=await audit();};
await shot('hud');
for(const id of ['bag','character','skills','progression','appearance','tasks','settings']){
 const b=page.locator(`[data-action=panel][data-id=${id}]`).first();
 if(!(await b.count())){continue;}
 try{await b.click({timeout:3000});await page.waitForTimeout(900);await shot(id);
 await page.keyboard.press('Escape');await page.waitForTimeout(300);
 if(await page.locator('#modal [data-action=close]').count())await page.locator('#modal [data-action=close]').first().click({timeout:1000}).catch(()=>{});await page.waitForTimeout(300);}catch(e){report[id+'-err']=String(e).slice(0,200);}
}
await page.close();
}
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,1));
for(const [k,v] of Object.entries(report)){if(!v.issues){console.log(k,v);continue;}const c={};v.issues.forEach(i=>c[i.type]=(c[i.type]||0)+1);console.log(k,'fonts',v.fonts.join(','),JSON.stringify(c));}
await browser.close();

import {readFile,writeFile,appendFile} from 'node:fs/promises';import {join} from 'node:path';import {group} from './pipeline.mjs';
let s=await readFile(join(group,'renderer.js'),'utf8');s=s.replace('canvas.width=canvas.height=camera.cell;gl.viewport(0,0,camera.cell,camera.cell)','canvas.width=canvas.height=camera.cell*2;gl.viewport(0,0,camera.cell*2,camera.cell*2)');await writeFile(join(group,'renderer.js'),s);
s=await readFile(join(group,'pipeline.mjs'),'utf8');s=s.replace("export const render=(ctx,action,time,camera)=>ctx.page.evaluate(({action,time,camera})=>window.petRender(action,time,camera),{action,time,camera});",`export async function render(ctx,action,time,camera){const r=await ctx.page.evaluate(({action,time,camera})=>window.petRender(action,time,camera),{action,time,camera});if(camera){const b=await sharp(Buffer.from(r.png.split(',')[1],'base64')).resize(camera.cell,camera.cell,{kernel:'lanczos3'}).png().toBuffer();r.png='data:image/png;base64,'+b.toString('base64');}return r;}`);await writeFile(join(group,'pipeline.mjs'),s);
s=await readFile(join(group,'paint.mjs'),'utf8');s=s.replace("if(r==='head'){const positions=", "if(r==='head'&&p.family!=='A7'){const positions=");
s=s.replace("const svg=`<svg",`if(p.family==='A7'&&/^pi[12]$/.test(n))body=\`<path d="\${path}" fill="\${c[0]}"/>\`;
 const svg=\`<svg`);
s=s.replace("records.push({...part,role:r",`if(p.family==='A7'&&r==='head'){const raw=await sharp(file+'.png').ensureAlpha().raw().toBuffer(),original=await sharp(part.original.path).resize(w*2,h*2).ensureAlpha().raw().toBuffer();for(let i=3;i<raw.length;i+=4)raw[i]=Math.min(raw[i],original[i]);await sharp(raw,{raw:{width:w*2,height:h*2,channels:4}}).png().toFile(file+'.png');}
 records.push({...part,role:r`);
await writeFile(join(group,'paint.mjs'),s);
await appendFile(join(group,'decisions.md'),'\n- 实测修正：A7 头部原图含透明眼窗，yan 与原生眼睑位于头部后方。恢复原 alpha 眼窗、取消覆盖窗的闭眼画线；保留原生层序和眼睑动作。\n- 导出改用 2× 硬件采样后缩至 256 单格，降低轻氪翼缘缩小锯齿；画布坐标、骨架和动作时序不变。\n- 原库 B7 是兜帽人形，候选筛查淘汰；沉星候选改为 A7 / A3，避免人形及恐怖元素。\n');
// Source-side manifests will be replaced by the new export, then losslessly partitioned again.

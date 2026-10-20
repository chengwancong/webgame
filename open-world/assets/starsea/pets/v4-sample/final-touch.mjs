import {readFile,writeFile,appendFile} from 'node:fs/promises';import {join} from 'node:path';import {group} from './pipeline.mjs';
let s=await readFile(join(group,'preview/view.js'),'utf8');
s=s.replace('ctx.translate(88,y)','ctx.translate(150,y)').replace("',88,y+26","',150,y+26").replace('ctx.translate(220,y)','ctx.translate(330,y)').replace("',220,y+26","',330,y+26");
s=s.replace('x=470+i*265','x=500+i*265').replace('x=425+i*500+j*160','x=465+i*500+j*160').replace('590+i*500','630+i*500').replace("time=.4;resize(2400","time=.15;resize(2400").replace("'idle',.4,x,y","'idle',.15,x,y");
s=s.replace("zoom=z*(normalize?44/p.displayHeight:1);","clip=p.actions[a],index=Math.min(clip.count-1,Math.floor((t%clip.duration)*p.fps)),frame=engine.bases.get(s.forms[f].base).atlas.frames[clip.frames[index]],zoom=z*(normalize?44/(frame.spriteSourceSize.h*p.scale):1);");
await writeFile(join(group,'preview/view.js'),s);
s=await readFile(join(group,'skins.mjs'),'utf8');s=s.replace("['#dbaf65','#916339','#fff1ac']","['#c99440','#79532d','#ffec9c']").replace("pet.style==='A'?18:15","pet.style==='A'?18:18").replace("anchor:[.5,.3],layer:18","anchor:[.5,.3],layer:pet.style==='B'?-1:18");await writeFile(join(group,'skins.mjs'),s);
s=await readFile(join(group,'verify-preview.mjs'),'utf8');s=s.replaceAll('window.pa5.setTime(.4)','window.pa5.setTime(.15)');await writeFile(join(group,'verify-preview.mjs'),s);
await appendFile(join(group,'decisions.md'),'\n- 饰甲 B 的职业围巾保留大号，调整到主体后层，给胸甲和宝石让位。\n- 44px 对照改为按当前帧真实 alpha 高度归一到 44px，避免翼展和呼吸导致虚标；该诊断倍率不改正式显示高度或原动作。\n- 总表取 idle 0.15 秒，避开原生 0.4 秒附近的眨眼，用于比较点眼和双高光。\n');

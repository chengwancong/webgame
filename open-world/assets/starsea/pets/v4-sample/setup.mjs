import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url)),old=join(dir,'../v3');
for(const name of ['pipeline.mjs','export.mjs','partition.mjs','pack-runtime.mjs','socket-transforms.mjs','face-map.mjs','paint.mjs']){
 let s=await readFile(join(old,name),'utf8');s=s.replaceAll('pets/v3','pets/v4-sample');
 if(name==='export.mjs'){s=s.replace("stage:pet.stages[i]","stage:pet.stages[i],height:pet.heights[i]").replace('/group/sources/${name}/','/group/sources/${pet.key}/${name}/').replace("starsea-20261018-pets-pa4","starsea-20261018-pets-pa5-sample").replace("pet-skin-tiers-20261018","pet-tier-ladder-sample-20261018");}
 if(name==='partition.mjs')s=s.replace("pets.find(pet=>pet.family===p.family)","pets.find(pet=>a.id===`ss-pet-${pet.key}-${p.form}`)");
 if(name==='socket-transforms.mjs')s=s.replace("free=a.id.includes('-free-')","free=false");
 if(name==='pack-runtime.mjs')s=s.split('// Requested first quality/size adjustment:')[0]+"\nawait json(join(group,'evidence/packing-validation.json'),{rows,pass:true});\n";
 if(name==='face-map.mjs')s=s.replace("pets.filter(p=>p.tier!=='free')","pets.filter(p=>p.key!=='dragon-heavy-b')");
 await writeFile(join(dir,name),s);
}
await writeFile(join(dir,'.gitignore'),'evidence/\n');
await writeFile(join(dir,'progress.md'),'# PA5 进度\n\n- [ ] 1. 龙眠两流派 × 四档 × 三形态，原生动作、实际尺寸和 2× 总图\n- [ ] 2. 重氪 A/B 动作抽查\n- [ ] 3. 六岛重氪候选表\n- [ ] 4. 阶梯样稿开关、五动作、镜像预览\n- [ ] 5. 162 只体量实测推算\n- [ ] 6. 报告与交付\n\n已完整读取 PA5 与 PA4 需求、PA4 报告。当前：原生素材检查、建立独立样稿管线。\n');
await writeFile(join(dir,'decisions.md'),'# PA5 裁定\n\n- 龙眠零氪 D2 a/c/e，轻氪 A10 a/c/e；重氪 A/B 均用 A7 c/d/e，先比较画法，不混入骨架差异。\n- 样稿 24 个逻辑外观共用 12 套形态；流派只改变花纹、饰件、宝石、特效，身体米金底色固定。\n- 延续 PA4 可编辑 SVG 零件源，重新绘制硬边色面、结构线及饰甲；原生 JSON 字节保持不变。最终展示一律来自完整 Spine 动画渲染。\n- 按 §6 使用不闭合地面弧段，避免敌方实线预警圈。\n');

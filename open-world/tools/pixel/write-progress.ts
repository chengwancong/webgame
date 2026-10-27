import fs from 'node:fs';
import path from 'node:path';
import {collectInventory,root} from './inventory.ts';
const file=path.join(root,'docs/hub-portal-rework-20261021/handoff/pixel-art-redraw-20261027-progress.md');
const rows=collectInventory(),manifestFile=path.join(root,'apps/web/public/art-pixel/manifest.json');
const manifest=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):{assets:{}};
const approved=new Set(Object.keys(manifest.assets)),originals=new Set<string>(Object.values(manifest.assets).flatMap((a:any)=>a.original??[]));
const covered=(r:typeof rows[number])=>{
 const paths=r.paths.map(p=>p.replace(/^(native-profile|motion):/,''));
 return ['npc','monsters','bosses','actor','hero','wardrobe'].includes(r.category)?approved.has(r.key)&&paths.every(p=>manifest.assets[r.key].original.includes(p)):paths.every(p=>originals.has(p));
};
function compactPaths(paths:string[]){
 if(paths.length<2)return paths[0]??'';
 const dirs=paths.map(p=>path.posix.dirname(p)),names=paths.map(p=>path.posix.basename(p));
 if(new Set(dirs).size===1)return dirs[0]+'/{'+names.join(',')+'}';
 if(new Set(names).size===1){const parts=dirs.map(p=>p.split('/'));let n=0;while(parts.every(p=>p[n]!==undefined&&p[n]===parts[0][n]))n++;const base=parts[0].slice(0,n).join('/');return base+'/{'+parts.map(p=>p.slice(n).join('/')).join(',')+'}/'+names[0];}
 return paths.join(', ');
}
const head=['# 像素美术重绘进度 · 2026-10-27','','## 资源盘点表','','口径：正式 main.ts 可达模块、运行时注册、可选换装与 v3 宠物；排除 QA、legacy、preview、evidence 和对话头像。JSON 路径代表原生角色/动作包，花括号是逐项路径的等价简写，路径中的 @ 等于本行资源键，code:src/ 等于 apps/web/src/，#elite 代表原有精英显示分支。盘点可由 node --import tsx tools/pixel/write-progress.ts 重建。','','| 资源键 | 原路径 | 类别 | 批次 | 状态 |','|---|---|---|---|---|'];
for(const r of rows){const missing=r.missing.filter(p=>!p.startsWith('native-profile:'));head.push(`|${r.key}|${compactPaths(r.paths).replaceAll('/'+r.key+'.png','/@.png').replaceAll('code:apps/web/src/','code:src/')}|${r.category}|${r.batch}|${covered(r)?'已绘':missing.length?'缺':'兜底'}|`);}
head.push('','<!-- inventory-end -->','',`盘点 ${rows.length} 键；manifest 覆盖 ${rows.filter(covered).length}/${rows.length}（${(rows.filter(covered).length/rows.length*100).toFixed(2)}%）。`,`PNG/WebP 源路径缺失 ${rows.reduce((n,r)=>n+r.missing.filter(p=>!p.startsWith('native-profile:')).length,0)} 条（包含多键共用路径，不等于独立缺图数）；原图缺失是原画风基线问题；像素成品独立校验计覆盖，不表示原图已恢复。`,'');
const initial=`## 批次验收\n\n- [ ] PX0 主色板、校验、资源加载、逐帧播放、低分辨率目标、港口竖切。提交：待完成。\n- [ ] PX1 七武器与换装。提交：待完成。\n- [ ] PX2 港口全部建筑道具。提交：待完成。\n- [ ] PX3 NPC。提交：待完成。\n- [ ] PX4 怪物、精英与首领。提交：待完成。\n- [ ] PX5 地表与生态。提交：待完成。\n- [ ] PX6 技能和命中特效。提交：待完成。\n- [ ] PX7 SP33 宠物。提交：待完成。\n- [ ] PX8 物品、技能与 HUD 图标。提交：待完成。\n- [ ] PX9 100% 覆盖、删除兜底、云测试服发布。提交：待完成。\n\n## 当前工作与验证\n\n- 基线 tsc --noEmit 通过。现有像素模式和接入文件已阅读；未运行任何浏览器自动化。\n- 新增 60 色主色板与五项校验工具；生成草稿仅作参考，不计入覆盖率。\n- proper-pixel-art 实际模块目录为 G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo；根 venv 未安装该模块，用 sys.path 加载本地源码可执行，无需下载。PX0 草稿网格恢复得到 357×355，仅为中间图。\n- 发布检查：现有 --remote-web 的 publicDir:false 不同步本机 art-pixel；必须补资源归档、哈希校验后再发布。\n\n## 待用户\n\n- 中文像素字体尚未下载。候选及协议需要查证后登记；保持当前字体不妨碍其他批次。\n\n## 校验未过和仍使用兜底的资源\n\n- 表中未重绘项目全部保持第 2 轮兜底。未验证图片禁止进入 manifest。\n\n## 给 Grok 的真机检查清单\n\n所有项目均为待真机检查，不能将单测通过写成真机通过。\n\n| 批次 | 检查项 |\n|---|---|\n| PX0 | 1280×720 开关即时切换；世界为 640×360 最近邻；主角剑七动作；港务长移动；三级样板物件和地表；关闭完全复原 |\n| PX1 | 七武器轮换；命中帧；左右镜像挂点；换装换色；帽披风轮廓 |\n| PX2 | 建筑 1–4 级；摊位与仓库；星门状态；门牌；无兜底 |\n| PX3 | 七名星海 NPC；七名剧情 NPC；野外 NPC；移动与对话头像 |\n| PX4 | 21 种怪与精英；六首领；读条与大招姿势；破绽；死亡 |\n| PX5 | 野外道路；副本边界；五岛海岸水面；自动拼接；碰撞和遮挡位置 |\n| PX6 | 各元素技能；命中特效；左右挂点；加色效果；前摇与命中时机 |\n| PX7 | 各 SP33 形态；待机移动攻击；与主角同尺度；换宠后恢复 |\n| PX8 | 背包 32px；快捷栏 16px；技能图标；HUD 边框；切换复原 |\n| PX9 | 全盘点无遗漏；切地图；刷新设置保留；关闭原画风；云服 manifest 和图片哈希一致 |\n`;
let tail=initial;if(fs.existsSync(file)){const old=fs.readFileSync(file,'utf8'),start=old.indexOf('## 批次验收');if(start>=0)tail=old.slice(start);}
fs.writeFileSync(file,head.join('\n')+tail,'utf8');console.log(JSON.stringify({rows:rows.length,covered:rows.filter(covered).length,bytes:fs.statSync(file).size}));

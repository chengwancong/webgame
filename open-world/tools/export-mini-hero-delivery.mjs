// Package only verified assets and real runtime evidence; retain the earlier standalone skin archive.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from './runtime.mjs';
const skin=join(root,'../experiments/sequence-reskin/skins/navy-traveler'),final=join(skin,'final');
const evidence=join(root,'../docs/reviews/open-world/mini-hero-integration-20261002');
const player=JSON.parse(await readFile(join(evidence,'result.json'),'utf8'));
const controlled=JSON.parse(await readFile(join(evidence,'controlled/result.json'),'utf8'));
assert.equal(player.passed,true);assert.equal(controlled.passed,true);
assert.deepEqual((await(await fetch('http://127.0.0.1:8612/api/health')).json()).versions,player.versions);
const output=join(final,'integration');await mkdir(output,{recursive:true});
for(const name of ['Character.json','Character.atlas','Character.png','Character_2.png']){
 assert((await readFile(join(final,'runtime',name))).equals(await readFile(join(root,'assets/mini-hero/navy/runtime',name))),`Accepted runtime changed: ${name}`);
}
for(const [source,name] of [
 [join(root,'apps/web/public/art/mini-hero/navy/profile.json'),'profile.json'],
 [join(root,'apps/web/public/art/mini-hero/navy/release-manifest.json'),'release-manifest.json'],
 [join(root,'docs/mini-hero-integration.md'),'game-integration.md'],
 [join(root,'docs/mini-hero-mapping.md'),'equipment-mapping.md'],
 [join(evidence,'result.json'),'real-player-path.json'],
 [join(evidence,'controlled/result.json'),'controlled-combat.json'],
 [join(evidence,'camp-1280x720.png'),'real-camp.png'],
 [join(evidence,'real-meadow-combat-1280x720.png'),'real-combat.png'],
 ])await copyFile(source,join(output,name));
const validation=JSON.parse(await readFile(join(final,'validation.json'),'utf8'));
Object.assign(validation,{formalGameIntegrated:true,formalGameQaPassed:true,formalGameVersions:player.versions,formalGameEvidence:'integration/real-player-path.json',controlledCombatEvidence:'integration/controlled-combat.json',supportedBodySets:['100011','100041'],supportedWeaponSets:['100011','300601','400105'],unsupportedAppearancePolicy:'retain-existing-legacy-renderer'});
await writeFile(join(final,'validation.json'),JSON.stringify(validation,null,2)+'\n');
let readme=await readFile(join(final,'README.md'),'utf8');
const previous='**正式游戏尚未切换到这个角色。** 当前项目的既有游戏角色使用另一套渲染结构，本包已在原Spine4.2骨骼预览中验证；将其接入正式游戏还需对应的渲染适配和战斗时序/特效挂点验收。本轮不宣称已有正式游戏截图或全部系统已落地。生产分发许可未在本轮核实。';
const current=`**已接入正式游戏${player.versions.client}。** 营地、战斗、HUD头像、人物页和外观预览使用同一原生Spine皮肤。已通过真实登录/装备切换/野外战斗/暂停/会话恢复及三原生武器的逐帧释放、镜像、死亡/复活验收；存档、回执与流水保留。\`integration/\` 保存实际接入配置、对应清单、两类验收结果及真实游戏截图。覆盖初始身体100011/100041与主手100011/300601/400105，其他外观保留既有渲染。正式法杖释放使用原Spell1，视觉时点映射至既定玩法前摇；本包原Cast1预设仍保留作为资源复用示例。生产分发许可仍未核实。`;
if(readme.includes(previous))readme=readme.replace(previous,current);else {assert(readme.includes('已接入正式游戏'),'Unexpected README status');readme=readme.split('\n').map(line=>line.startsWith('**已接入正式游戏')?current:line).join('\n');}
await writeFile(join(final,'README.md'),readme);
const archive=join(skin,'mini-navy-traveler-01-integrated.zip');
const zipCode=`from pathlib import Path\nimport zipfile,sys\nbase=Path(sys.argv[1]); out=Path(sys.argv[2])\nfiles=sorted(p for p in base.rglob('*') if p.is_file())\nwith zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n for p in files:\n  info=zipfile.ZipInfo(p.relative_to(base).as_posix(),date_time=(2026,10,2,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED\n  z.writestr(info,p.read_bytes(),compresslevel=9)\nprint(str(out)+' '+str(len(files))+' files '+str(out.stat().st_size)+' bytes')`;
const result=spawnSync('python3',['-c',zipCode,final,archive],{encoding:'utf8',windowsHide:true});
if(result.status!==0)throw Error(result.stderr||result.error?.message||'Archive export failed');console.log(result.stdout.trim());

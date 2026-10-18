import {it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {prologueConfig,prologueFamilies} from '../packages/content/starsea/prologue.ts';
import {starseaBalance} from '../packages/content/starsea/balance.ts';
import {gearBases} from '../packages/rules/index.ts';
import {skillCatalog} from '../packages/content/index.ts';
import {permitsWeapon} from '../packages/contracts/weapons.ts';
// 开场「坠星觉醒」配置：初始武器同档同攻、起手技能与武器相符；授予构筑与推导工具一致（docs/opening-hook-design.md）。
it('starter weapons differ only in family',()=>{
 expect(prologueConfig.families.sword.weaponTemplate).toBe(starseaBalance.starterWeapon.template);
 const sword=gearBases.find(g=>g.base===starseaBalance.starterWeapon.template)!;
 for(const family of prologueFamilies){const t=gearBases.find(g=>g.base===prologueConfig.families[family].weaponTemplate)!;expect(t.slot).toBe('weapon');expect(t.attack).toBe(sword.attack);expect(t.armor).toBe(sword.armor);}
});
it('starter and granted skills fit the chosen weapon',()=>{
 for(const family of prologueFamilies){const f=prologueConfig.families[family];
  for(const id of [...f.starterSkills,...f.grantedSkills]){const s=skillCatalog.find(s=>s.id===id);expect(s,id).toBeDefined();expect(permitsWeapon(s!.weapons,family),id).toBe(true);}
  expect(f.granted.skills.map(s=>s.id)).toEqual(f.grantedSkills);expect(f.granted.stats.weapon).toBe(family);
 }
});
it('prologue.json matches the granted-build derivation',()=>{
 const r=spawnSync(process.execPath,['--import','tsx','tools/prologue-build.ts','--check'],{encoding:'utf8',windowsHide:true});expect(r.status,r.stderr+r.stdout).toBe(0);
},60000);

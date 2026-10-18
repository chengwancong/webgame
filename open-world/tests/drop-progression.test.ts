import {it,expect} from 'vitest';
import {dropProfileFor,rollGearDrop,encounterDropProfiles,scaleWorldGear} from '../apps/api/src/economy.ts';
import {generateAffixes} from '../packages/rules/affix-generator.ts';
import {regions,dungeonRegionInfo} from '../packages/content/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {campaignCharacter} from '../tools/campaign-model.ts';
it('later gear has actual regional primary attributes without rewriting starter instances',()=>{
 const blade=makeGear(0,'weapon'),coat=makeGear(2,'armor');
 expect(['meadow','forest','rift','tundra','abyss','dragonbone'].map(area=>scaleWorldGear(blade,dropProfileFor(area)).attack)).toEqual([9,12,15,20,25,32]);
 expect(['meadow','forest','rift','tundra','abyss','dragonbone'].map(area=>scaleWorldGear(coat,dropProfileFor(area)).armor)).toEqual([4,5,7,9,11,14]);
 expect(blade.attack).toBe(9);expect(coat.armor).toBe(4);expect(scaleWorldGear(blade,{}).attack).toBe(9);
 const state=campaignCharacter('starter');state.gear[0]=scaleWorldGear(blade,dropProfileFor('dragonbone'));state.gear[1]=scaleWorldGear(coat,dropProfileFor('dragonbone'));expect(resolveBuild(state).stats.attack).toBeGreaterThan(40);expect(resolveBuild(state).stats.armor).toBe(14);
});
it('covers every published field with private drop rules and valid weight totals',()=>{
 for(const r of regions.filter(r=>!r.id.startsWith('ss-map-')&&r.id!=='town')){const p=dropProfileFor(r.id);for(const row of [p.normal.quality,p.elite.quality,p.boss.quality,p.firstBoss])expect(Object.values(row).reduce((a,b)=>a+b,0)).toBe(100);}
 expect(encounterDropProfiles).toHaveLength(regions.filter(r=>!r.id.startsWith('ss-map-')&&r.id!=='town'&&!r.boss&&!dungeonRegionInfo(r.id)).length);
 for(const region of regions.filter(r=>dungeonRegionInfo(r.id)))expect(dropProfileFor(region.id)).toEqual(dropProfileFor(dungeonRegionInfo(region.id)!));
});
it('the first meadow clear guarantees rare gear; repeated clears cannot produce legendary',()=>{
 const p=dropProfileFor('meadow-boss');
 for(let i=0;i<512;i++){expect(rollGearDrop({boss:true,elite:true},p,true)).toBe('rare');expect(['magic','rare']).toContain(rollGearDrop({boss:true,elite:true},p,false));}
});
it('early fields cannot roll legendary gear or late affix tiers',()=>{
 for(const area of ['meadow','forest']){const p=dropProfileFor(area);for(let i=0;i<512;i++)expect(rollGearDrop({boss:false,elite:true},p,false)).not.toBe('legendary');}
 for(let i=0;i<64;i++){const affixes=generateAffixes('rare',dropProfileFor('meadow').maxAffixTier);expect(affixes.length).toBeGreaterThan(0);expect(affixes.every(a=>a.tier===1)).toBe(true);}
});

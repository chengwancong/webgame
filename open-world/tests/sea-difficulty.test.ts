// B3: 海域难度面板的定向测试——星级/一句话/解锁句都由服务端给出，倍率只留在折叠区。
import {it,expect} from 'vitest';
import {worldTierChoices,worldTier,roman,worldTierUnlocked} from '../packages/rules/world-tier.ts';
import {seaDifficultyHtml,seaDifficultyView} from '../apps/web/src/sea-difficulty-view.ts';
import {worldTierChoiceSchema} from '../packages/contracts/open-world.ts';
import {starseaHub} from '../packages/content/starsea/index.ts';
import {hits} from '../tools/copy-voice-scan.ts';
import type {SeaDifficultyView} from '../apps/web/src/sea-difficulty-view.ts';

const player=(over:{level?:number;hardmode?:boolean;bosses?:string[];hardmodeBosses?:string[];unlockedWorldTier?:number;worldTier?:number}={})=>{
 const s={level:over.level??50,world:{unlockedWorldTier:over.unlockedWorldTier??1,worldTier:over.worldTier??1,hardmodeBosses:over.hardmodeBosses??[]},starsea:{bosses:over.bosses??[],hardmode:over.hardmode??false,islands:[]}} as never;
 return s;
};
const view=(tiers:ReturnType<typeof worldTierChoices>,current=1):SeaDifficultyView=>({current,canSwitch:true,tiers});

it('tier names read as sea names, never as "深渊 5"',()=>{
 expect(roman(2)).toBe('II');expect(roman(11)).toBe('XI');expect(roman(97)).toBe('XCVII');
 const choices=worldTierChoices(player({unlockedWorldTier:6,hardmode:true,bosses:['ss-map-boss-1']}));
 expect(choices.map(c=>c.name)).toEqual(['航行','风暴','潮涌','深渊','深渊 II','深渊 III','深渊 IV']);
 for(const c of choices){expect(c.name).not.toMatch(/\s\d+$/);worldTierChoiceSchema.parse(c);}
});
it('every tier shows stars, one line of blurb and a real unlock reason',()=>{
 const choices=worldTierChoices(player({unlockedWorldTier:6,hardmode:true,bosses:['ss-map-boss-1'],hardmodeBosses:['ss-map-boss-1']}));
 expect(choices.length).toBeGreaterThan(4);
 for(const c of choices){expect(c.danger).toBeGreaterThanOrEqual(1);expect(c.danger).toBeLessThanOrEqual(5);expect(c.rewardStars).toBeGreaterThanOrEqual(1);expect(c.rewardStars).toBeLessThanOrEqual(5);expect(c.summary.length).toBeGreaterThan(4);expect(c.summary.length).toBeLessThanOrEqual(16);}
 // 越深的海危险越高，收益也越好。
 for(let i=1;i<choices.length;i++){expect(choices[i].danger).toBeGreaterThanOrEqual(choices[i-1].danger);expect(choices[i].rewardStars).toBeGreaterThanOrEqual(choices[i-1].rewardStars);}
 const locked=choices.find(c=>!c.unlocked)!;
 expect(locked.unlockText.length).toBeGreaterThan(4);
 expect(choices.find(c=>c.tier===5)!.unlockText).toContain('在深渊里打通一座地城');
});
it('the panel lists stars and puts the multipliers behind a折叠',()=>{
 const choices=worldTierChoices(player({unlockedWorldTier:6,hardmode:true,bosses:['ss-map-boss-1'],hardmodeBosses:['ss-map-boss-1']}));
 const html=seaDifficultyHtml(view(choices,3),3,false);
 expect(html).toContain('越危险的海，带回的东西越好');
 expect(html).toContain('潮涌');expect(html).toContain('当前');expect(html).toContain('已在此海域');
 expect(html).toContain('<details');expect(html).toContain('详细数值');
 expect(html).toContain('推荐等级');
 // 倍率只在折叠里，主文案不出现“×”。
 const main=html.split('<details')[0];
 expect(main).not.toContain('×');
 for(const word of ['世界层级','相对','权重','保底','新刷出的营地'])expect(html).not.toContain(word);
 for(const line of html.split(/<[^>]+>/).filter(t=>t.trim()))expect(hits(line)).toEqual([]);
});
it('a locked tier offers no travel button and says what is missing',()=>{
 const choices=worldTierChoices(player());
 const html=seaDifficultyHtml(view(choices,1),2,false);
 expect(html).toContain('风暴');expect(html).toContain('击败第三岛首领后开启');
 expect(html).not.toContain('前往此海域 · 风暴');
});
it('the panel only exists for starsea saves and the port can switch',()=>{
 const choices=worldTierChoices(player({hardmode:true}));
 const snapshot={starsea:{islands:[],bosses:[],hardmode:true},worldTierChoices:choices,world:{worldTier:1},worldView:{waypoints:[]}} as never;
 expect(seaDifficultyView(undefined,starseaHub,{x:0,y:0})).toBeUndefined();
 expect(seaDifficultyView(snapshot,starseaHub,{x:0,y:0})?.canSwitch).toBe(true);
 expect(seaDifficultyView(snapshot,'ss-map-wind',{x:0,y:0})?.canSwitch).toBe(false);
 expect(seaDifficultyHtml({current:1,canSwitch:true,tiers:[]},1,false)).toContain('远航开启后');
});
it('unlock stays derived from progress, not stored',()=>{
 expect(worldTierUnlocked(player(),1)).toBe(true);
 expect(worldTierUnlocked(player(),2)).toBe(false);
 expect(worldTierUnlocked(player({bosses:['ss-map-boss-3']}),2)).toBe(true);
 expect(worldTierUnlocked(player({unlockedWorldTier:7,hardmode:true,bosses:['ss-map-boss-3']}),4)).toBe(false); // 还差六岛裂星潮首领
 expect(worldTier(4).name).toBe('深渊');
});

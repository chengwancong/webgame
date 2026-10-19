import {expect,it} from 'vitest';
import {makeGear,gearContribution} from '../packages/rules/index.ts';
import {mainStatContribution} from '../packages/rules/main-stats.ts';
import {gearMainStat,mainStatText} from '../apps/web/src/components/CharacterPanel.ts';
import {GearCard} from '../apps/web/src/components/GearCard.ts';
import {renderEquipmentTip} from '../apps/web/src/equipment-tip.ts';
import {gearSetDetails} from '../apps/web/src/components/gear-metadata.ts';
import {affixDisplayValue} from '../packages/contracts/affix-units.ts';
import {vitalsDisplay} from '../apps/web/src/vitals-display.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import type {GearTip,EquippedSetInfo} from '../packages/contracts/index.ts';
const plain=(s:string)=>s.replace(/<[^>]*>/g,'');
it.each([['attackPercent',.05,'5%'],['castSpeed',.04,'4%'],['hpPercent',.05,'5%']] as const)('BUG-42 %s has the same value on candidate cards and server-resolved details', (stat,value,text)=>{
 const g={...makeGear(0,'00000000-0000-4000-8000-000000000001'),mainStat:{stat,value},rank:0};
 const main=gearMainStat(g)!,resolved=mainStatContribution(g)!;expect(main.value).toBe(resolved.effective);expect(mainStatText(main.stat,main.value)).toBe(text);
 const row={current:0,equipped:value,delta:value},tip={gear:g,primary_attribute:stat,revision:0,ruleset_version:'test',equipped:false,max_rank:5,attributes:gearContribution(g),effect_description:'',replaces:null,comparison:{attack:row,armor:row},currentSets:[],equippedSets:[]} as GearTip;
 expect(plain(GearCard(g,{revision:0,details:tip}))).toContain(text);expect(plain(renderEquipmentTip(tip))).toContain(text);
});
it('BUG-43 formats flat floating point values once without precision noise',()=>expect(affixDisplayValue('regen',13.200000000000001)).toBe('13.2'));
it('BUG-44 unowned set pieces use the server projected description instead of unscaled catalogue copy',()=>{
 const g={...makeGear(0,'gear'),setId:'set-hammer-standard',setName:'石卫誓约'},sets:EquippedSetInfo[]=[{setId:g.setId,setName:g.setName,count:1,total:6,activeBonuses:[],artStage:1,bonusDescriptions:{'2':'护甲提高 5%','4':'命中同一目标 +5.7%'}}];
 expect(plain(gearSetDetails(g,[],sets))).toContain('命中同一目标 +5.7%');expect(plain(gearSetDetails(g,sets))).toContain('命中同一目标 +5.7%');
});
it('BUG-39 both safe scenes use final snapshot vitals while live combat keeps executor HP',()=>{
 const stats={hp:198,attack:1,armor:0,speed:6,mana:100,regen:0,effects:[]},snapshot={stats:{...stats,hp:337}};
 const w=new World(regionById('town'),stats,[],[]);expect(vitalsDisplay(w,snapshot)).toMatchObject({hp:337,maxHp:337});
 w.region=regionById('ss-map-port');expect(vitalsDisplay(w,snapshot)).toMatchObject({hp:337,maxHp:337});
 w.region=regionById('meadow');w.hero.hp=65;expect(vitalsDisplay(w,snapshot)).toMatchObject({hp:65,maxHp:198});
});

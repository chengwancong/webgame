import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {CharacterState,Snapshot} from '../packages/contracts/index.ts';
import {makeHexGear} from '../packages/rules/hex-runes.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {publicHexRunes} from '../packages/content/hex-runes.ts';
import {hexCatalogById,hexSlotRowInputFromSnapshot} from '../apps/web/src/hex-rune-view.ts';
import {HexSlotRow} from '../apps/web/src/hex-rune-slots.ts';
import {BagPanel} from '../apps/web/src/components/BagPanel.ts';
import {initialBagDraft} from '../apps/web/src/bag-model.ts';
import type {BagUI} from '../apps/web/src/bag-controller.ts';
const catalog=hexCatalogById(publicHexRunes);
function fixture(level:number):Snapshot{
 const state:CharacterState={id:randomUUID(),name:'HEX渲染复验',revision:1,build:1,level,xp:0,gold:0,material:0,gear:['common','magic','rare','legendary'].map(q=>makeHexGear('hex-chain-lightning',q as 'common'|'magic'|'rare'|'legendary',randomUUID())),equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}};
 return {...state,...resolveBuild(state),capacity:60,rewards:[]};
}
it.each([[1,0],[10,1],[15,2],[20,3],[25,4],[30,4]])('counts level %s eligible candidates without hiding owned locked-level items',(level,count)=>{
 const s=fixture(level),input=hexSlotRowInputFromSnapshot(s,catalog)!;
 expect(input.slots.hex1.candidates).toBe(count);expect(input.slots.hex2.candidates).toBe(count);
 const html=HexSlotRow(input);if(count===0){expect(html).toContain('暂无可装配');expect(html).not.toContain('枚可放入');}
 expect(s.gear).toHaveLength(4);
});
it('keeps HEX grid focus/hover off the ordinary gear-tip path and renders its real mechanism',()=>{
 const s=fixture(30);
 for(const gear of s.gear){
  const ui:BagUI={...initialBagDraft(),selected:'gear:'+gear.id,loading:false,quoteTarget:'',quoteCharacter:'',quoteLoading:false,busy:false,message:'',error:'',status:''};
  const html=BagPanel({snapshot:s,ui,quality:'',slot:'',busy:false,blocked:false,hexCatalog:catalog});
  expect(html).not.toContain('data-equipment-tip');expect(html).not.toContain('报价读取失败');
  expect(html).toContain('固定品质');expect(html).toContain('连锁闪电');expect(html).toContain('传导');
 }
});

import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {CharacterState,Snapshot} from '../packages/contracts/index.ts';
import type {HexActive} from '../packages/contracts/hex-runes.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {publicHexRunes} from '../packages/content/hex-runes.ts';
import {hexPreviewHtml,hexAffixOf,hexAffixSectionHtml,hexCatalogById,hexMarks,hexResonanceOf,setHexContext} from '../apps/web/src/hex-rune-view.ts';
import {hexInactiveReasonText,renderHexAffixRow} from '../apps/web/src/hex-rune-tip.ts';
import {BagPanel} from '../apps/web/src/components/BagPanel.ts';
import {CharacterPaperdoll} from '../apps/web/src/components/CharacterPaperdoll.ts';
import {initialBagDraft,bagItems} from '../apps/web/src/bag-model.ts';
import type {BagUI} from '../apps/web/src/bag-controller.ts';
const catalog=hexCatalogById(publicHexRunes);
const banned=/槽|镶嵌|选奖|碎片/;
// HEX-F03 (d13): HEX is `gear.hex` on ordinary gear; the server's snapshot.hexActive decides what is in effect, the client only displays it.
function fixture(){
 const plain=makeGear(0,randomUUID()),worn=makeGear(1,randomUUID()),dup=makeGear(2,randomUUID());
 worn.hex={rune:'hex-chain-lightning',tier:'magic'};worn.quality='magic';
 dup.hex={rune:'hex-chain-lightning',tier:'common'};dup.quality='magic';
 const hexActive:HexActive[]=[{gear:worn.id,rune:'hex-chain-lightning',tier:'magic',active:true,resonance:1.1},{gear:dup.id,rune:'hex-chain-lightning',tier:'common',active:false,reason:'group'}];
 const state:CharacterState={id:randomUUID(),name:'HEX渲染复验',revision:1,build:1,level:30,xp:0,gold:0,material:0,gear:[plain,worn,dup],equipment:{[worn.slot]:worn.id},skills:[],skillRanks:{},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}};
 const snapshot:Snapshot={...state,...resolveBuild(state),capacity:60,rewards:[],hexActive};
 return {snapshot,plain,worn,dup,hexActive};
}
it('reads the server verdict from hexActive without recomputing it',()=>{
 const {plain,worn,dup,hexActive}=fixture();
 expect(hexAffixOf(plain,hexActive,catalog)).toBeUndefined();
 expect(hexAffixOf(worn,hexActive,catalog)).toMatchObject({runeId:'hex-chain-lightning',tier:'magic',active:true,worn:true});
 expect(hexAffixOf(dup,hexActive,catalog)).toMatchObject({active:false,reason:'group',worn:true});
 // Unworn gear has no server verdict: shown neutral, never guessed inactive.
 expect(hexAffixOf(worn,[],catalog)).toMatchObject({active:true,worn:false});
 expect(hexResonanceOf(hexActive)).toBe(1.1);expect(hexResonanceOf([{...hexActive[0],resonance:undefined}])).toBeUndefined();
});
it('renders the HEX tip row, greyed with the reason when inactive',()=>{
 const {worn,dup,plain,hexActive}=fixture();setHexContext(catalog,hexActive);
 const on=hexAffixSectionHtml(worn),off=hexAffixSectionHtml(dup);
 expect(on).toContain('连锁闪电');expect(on).toContain('装备词缀');expect(on).not.toContain('is-inactive');expect(on).not.toContain('同类已有更高品质');
 expect(off).toContain('is-inactive');expect(off).toContain('同类已有更高品质');
 expect(hexAffixSectionHtml(plain)).toBe('');
 expect(on+off).not.toMatch(banned);
});
it('marks paperdoll and bag cells with a hexagon badge only for gear that carries a HEX',()=>{
 const {snapshot,plain,worn,dup}=fixture();setHexContext(catalog,snapshot.hexActive);
 expect(hexMarks(plain,snapshot)).toEqual([]);
 expect(hexMarks(worn,snapshot)[0]).toMatchObject({kind:'hex',label:'带海克斯词缀'});
 expect(hexMarks(dup,snapshot)[0]).toMatchObject({kind:'hex',label:'海克斯词缀未生效'});
 const doll=CharacterPaperdoll(snapshot,'');
 expect(doll).toContain('ui-slot-mark--hex');expect(doll).toContain('共鸣 ×1.1（同打法）');expect(doll).not.toContain('hex-slot');expect(doll).not.toMatch(banned);
 const ui:BagUI={...initialBagDraft(),category:'equipment',loading:false,quoteTarget:'',quoteCharacter:'',quoteLoading:false,busy:false,message:'',error:'',status:''};
 const html=BagPanel({snapshot,ui,quality:'',slot:'',busy:false,blocked:false});
 expect(html).toContain('data-action="bag-hex"');expect(html).toContain('ui-slot-mark--hex');expect(html).not.toMatch(banned);
});
it('words every inactive reason distinctly and puts the badge top-right',()=>{
 expect(hexInactiveReasonText('duplicate')).toBe('已有同名海克斯生效');
 expect(hexInactiveReasonText('group')).toBe('同类已有更高品质');
 expect(hexInactiveReasonText('level',30)).toBe('需 30 级');expect(hexInactiveReasonText('level')).toBe('等级不足');
 expect(hexInactiveReasonText()).toBe('未生效');
 const {snapshot,dup}=fixture();setHexContext(catalog,snapshot.hexActive);
 expect(hexMarks(dup,snapshot)[0].corner).toBe('tr');
 const row=(reason?:string)=>renderHexAffixRow(catalog['hex-chain-lightning'],'common',{active:false,reason});
 expect(row('level')).toMatch(/需 \d+ 级/);expect(row('duplicate')).toContain('已有同名海克斯生效');expect(row('group')).toContain('同类已有更高品质');
});
it('filters the bag shelf to HEX gear',()=>{
 const {snapshot,worn,dup}=fixture();
 const draft={...initialBagDraft(),category:'equipment' as const};
 const ids=(hexOnly:boolean)=>bagItems(snapshot,{...draft,hexOnly},'','').flatMap(item=>item.kind==='equipment'?[item.gear.id]:[]);
 expect(ids(false)).toHaveLength(3);
 expect(ids(true).sort()).toEqual([worn.id,dup.id].sort());
});

it('renders the compare block from server changes only',()=>{
 const {worn,dup}=fixture();
 expect(hexPreviewHtml(undefined,catalog)).toBe('');
 const html=hexPreviewHtml({changes:[{gear:worn.id,rune:'hex-chain-lightning',tier:'magic',change:'activate'},{gear:dup.id,rune:'hex-chain-lightning',tier:'common',change:'deactivate',reason:'duplicate'},{gear:dup.id,rune:'hex-chain-lightning',tier:'common',change:'deactivate',reason:'level'},{gear:worn.id,rune:'hex-chain-lightning',tier:'magic',change:'unchanged'}]},catalog);
 expect(html).toContain('将生效');expect(html).toContain('已有同名海克斯生效');expect(html).not.toContain('同类已有更高品质');expect(html).toMatch(/需 \d+ 级/);expect(html).toContain('不变');expect(html).not.toMatch(banned);
});

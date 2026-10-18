import {expect,it} from 'vitest';
import type {CharacterState,Snapshot} from '../packages/contracts/index.ts';
import {progressionStateSchema} from '../packages/contracts/deep-progression.ts';
import {starterSkills} from '../packages/content/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {previewProgressionAction} from '../packages/rules/deep-progression.ts';
import {bagItems,bagCounts,inventoryItems,initialBagDraft,materialDestinations} from '../apps/web/src/bag-model.ts';
import type {BagUI} from '../apps/web/src/bag-controller.ts';
import {BagPanel,bagItemTip} from '../apps/web/src/components/BagPanel.ts';
import {CharacterPanel,characterSelection} from '../apps/web/src/components/CharacterPanel.ts';

function fixture():Snapshot{
 const gear=[makeGear(0,'blade'),makeGear(3,'charm'),makeGear(4,'core')];
 const state:CharacterState={id:'bag-player',name:'行囊测试',revision:5,build:1,level:1,xp:0,gold:143,material:9,gear,equipment:{weapon:gear[0].id,accessory:gear[1].id,core:gear[2].id},skills:[...starterSkills],skillRanks:{...Object.fromEntries(starterSkills.map(id=>[id,1])),ember:1},skillBooks:{ember:2,chain:1},progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]},progression:progressionStateSchema.parse({consumables:{tonic_attack:3,tonic_hp:0},materials:{ore:7,herb:0},buffs:{}})};
 return {...state,...resolveBuild(state),capacity:60,rewards:[]};
}
function ui(selected=''):BagUI{return {...initialBagDraft(),selected,loading:false,quoteTarget:'',quoteCharacter:'',quoteLoading:false,busy:false,message:'',error:'',status:''};}
function render(snapshot:Snapshot,view:BagUI){return BagPanel({snapshot,ui:view,quality:'',slot:'',busy:false,blocked:false});}

it('projects actual independent inventories without modifying persistent state or counting materials as equipment',()=>{
 const snapshot=fixture(),before=structuredClone(snapshot),all=inventoryItems(snapshot),visible=bagItems(snapshot,initialBagDraft(),'','');
 expect(all.find(item=>item.key==='tonic:tonic_attack')?.quantity).toBe(3);
 expect(all.find(item=>item.key==='book:ember')?.quantity).toBe(2);
 expect(all.find(item=>item.key==='material:wind_ore')?.quantity).toBe(7);expect(all.find(item=>item.key==='material:ore')).toBeUndefined();
 expect(all.find(item=>item.key==='material:enhance_stone')?.quantity).toBe(9);
 expect(visible).toHaveLength(8);expect(bagCounts(all).equipment).toBe(3);
 expect(render(snapshot,ui()).match(/<div class="bag-capacity">([\s\S]*?)<\/div>/)?.[1].replace(/<[^>]+>/g,'')).toContain('3/60');expect(snapshot).toEqual(before);
});
it('uses equipment filters only for the equipment category and never maps core to a new empty part',()=>{
 const snapshot=fixture(),draft=initialBagDraft();
 expect(bagItems(snapshot,draft,'legendary','helmet')).toHaveLength(8);
 draft.category='equipment';expect(bagItems(snapshot,draft,'','necklace').map(item=>item.key)).toEqual(['gear:charm']);
 for(const part of ['helmet','boots','ring'] as const)expect(bagItems(snapshot,draft,'',part)).toEqual([]);
 expect(characterSelection(snapshot,'core','').selected?.id).toBe('core');
});
it('keeps an active last-used tonic inspectable at zero stock and displays remaining kills, not seconds',()=>{
 const snapshot=fixture();snapshot.progression!.consumables.tonic_attack=0;snapshot.progression!.buffs.tonic_attack=7;
 const view=ui('tonic:tonic_attack');view.category='consumables';
 expect(bagItems(snapshot,view,'','').some(item=>item.key===view.selected)).toBe(true);
 const html=render(snapshot,view);expect(html).toContain('剩余 7 次真实击杀');expect(html).toMatch(/data-action="bag-use-tonic"[^>]*disabled/);expect(html).not.toContain('7 秒');
});
it('requires a current server quote before use and labels the one-bottle charge even when currency costs are zero',()=>{
 const snapshot=fixture(),view=ui('tonic:tonic_attack');view.quote=previewProgressionAction(snapshot,{op:'consumable.use',target:'tonic_attack'});view.quoteTarget='tonic_attack';view.quoteCharacter=snapshot.id;
 const html=render(snapshot,view);expect(html).toContain('本次消耗攻击合剂 1 份');expect(html).not.toMatch(/data-action="bag-use-tonic"[^>]*disabled/);
 view.quote={...view.quote,revision:snapshot.revision-1};expect(render(snapshot,view)).toMatch(/data-action="bag-use-tonic"[^>]*disabled/);
});
it('routes learned and ready skill books to skills without a generic consume command',()=>{
 const snapshot=fixture(),view=ui('book:ember');
 const learned=render(snapshot,view);expect(learned).toContain('不会重复消耗技能书');expect(learned).toContain('data-action="bag-skill" data-id="ember"');expect(learned).not.toContain('data-action="bag-use-tonic"');
 view.selected='book:chain';const ready=render(snapshot,view);expect(ready).toContain('未激活 · 可激活');expect(ready).toContain('前往激活');expect(ready).not.toContain('data-action="skill-activate"');
});
it('provides material navigation and zero inventory inspection without equipment or consume actions',()=>{
 const snapshot=fixture(),view=ui('material:wind_ore');view.category='materials';
 const html=render(snapshot,view);expect(html).toContain('data-action="bag-workshop"');expect(html).toContain('风栖岛');expect(html).not.toContain('data-action="upgrade"');expect(html).not.toContain('data-action="bag-use-tonic"');
 view.showZero=true;expect(bagItems(snapshot,view,'','')).toHaveLength(75);view.category='quest';expect(bagItems(snapshot,view,'','')).toEqual([]);expect(render(snapshot,view)).toContain('暂无任务物品');
});
it('preserves unknown legacy materials with a generic icon and no configured operation',()=>{
 const snapshot=fixture();snapshot.progression!.materials.old_material=19;const view=ui('material:old_material');view.category='materials';
 expect(inventoryItems(snapshot).find(item=>item.key===view.selected)).toMatchObject({quantity:19,icon:'sys-bag',use:'暂无用途',destination:undefined});
 expect(render(snapshot,view)).toMatch(/data-action="bag-progression"[^>]*disabled/);
});
it('keeps every bag category free of character controls while the separate character retains exactly six parts and the legacy core',()=>{
 const snapshot=fixture(),view=ui();
 for(const category of ['all','equipment','consumables','materials','quest'] as const){view.category=category;const html=render(snapshot,view);expect(html).not.toContain('doll-stage');expect(html).not.toContain('data-equipment-part');expect(html).not.toContain('doll-stats');}
 const character=CharacterPanel(snapshot,'core','core',undefined,false);expect(character.match(/data-equipment-part=/g)).toHaveLength(6);expect(character).toContain('legacy-core-entry');expect(character).toContain('data-id="core"');expect(character).not.toContain('data-action="bag-category"');
});
it('keeps recovery reachable in every category, including the empty task page, independently of item messages',()=>{
 const snapshot=fixture(),view=ui();view.status='pending';view.message='';
 for(const category of ['all','equipment','consumables','materials','quest'] as const){view.category=category;const html=BagPanel({snapshot,ui:view,quality:'',slot:'',busy:false,blocked:true});expect(html).toContain('bag-global-recovery');expect(html).toContain('合剂使用待确认');expect(html.match(/data-action="recover"/g)).toHaveLength(1);}
});
it('keeps character-total comparisons in the character panel rather than the bag equipment detail',()=>{
 const snapshot=fixture(),view=ui('gear:blade');view.category='equipment';
 expect(render(snapshot,view)).not.toContain('class="cmp"');
 expect(CharacterPanel(snapshot,'weapon','blade',undefined,false,{chooserOpen:true,detailsOpen:true,blocked:false})).toContain('class="cmp"');
});
it('exposes equipment quality on the bag card and detail without assigning equipment quality to materials',()=>{
 const snapshot=fixture();snapshot.gear[0].quality='rare';const html=render(snapshot,ui('gear:blade'));
 expect(html).toContain('data-item-kind="equipment" data-quality="rare"');expect(html).toContain('quality-rare is-selected');expect(html).toContain('稀有品质，持有1');expect(html).toContain('gear-detail bag-detail quality-rare');expect(html).not.toContain('data-item-kind="materials" data-quality');
});
it('keeps generic item tips truthful for materials, active tonics and learned books',()=>{
 const snapshot=fixture();snapshot.progression!.buffs.tonic_attack=7;const items=inventoryItems(snapshot);
 const material=items.find(item=>item.key==='material:wind_ore')!,tonic=items.find(item=>item.key==='tonic:tonic_attack')!,book=items.find(item=>item.key==='book:ember')!;
 expect(JSON.parse(bagItemTip(material)!)).toMatchObject({item:true,note:'拾星港工坊制作、提纯与精工'});expect(bagItemTip(tonic)).toContain('7 次真实击杀');expect(bagItemTip(tonic)).not.toContain('7秒');expect(bagItemTip(book)).toContain('不会重复消耗技能书');expect(bagItemTip(items.find(item=>item.kind==='equipment')!)).toBeUndefined();expect(render(snapshot,ui())).toContain('data-tip=');
});
it('carries an explicit bag equipment id and keeps that candidate ahead of the currently worn item',()=>{
 const snapshot=fixture(),candidate=makeGear(3,'spare-charm');snapshot.gear.push(candidate);
 const view=ui('gear:'+candidate.id);view.category='equipment';
 expect(render(snapshot,view)).toContain(`data-action="bag-character" data-id="${candidate.id}"`);
 expect(characterSelection(snapshot,'necklace',candidate.id).selected?.id).toBe(candidate.id);
 expect(characterSelection(snapshot,'core','core').selected?.id).toBe('core');
 expect(characterSelection(snapshot,'necklace',candidate.id).items.every(gear=>gear.slot==='accessory')).toBe(true);
});

it('registered rubbing materials have unique official icons and route to the public imprint section',()=>{const rubbing=Object.keys(materialDestinations).filter(id=>id.startsWith('rubbing-'));expect(rubbing).toHaveLength(41);for(const id of rubbing){expect(materialDestinations[id].section).toBe('inscriptions');expect(materialDestinations[id].item).toBe(id);}});

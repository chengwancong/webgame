import {expect,it} from 'vitest';
import type {Reward} from '../packages/contracts/index.ts';
import {regionById} from '../packages/content/index.ts';
import {nearbyLoot,groundLootArt,lootLayout} from '../apps/web/src/ground-loot.ts';
const region={...regionById('meadow'),obstacles:[]},hero={x:10,y:10};
const reward=(id:string,x=11,y=10,quality:'common'|'rare'='common'):Reward=>({id,source_id:id,region:'meadow',position:{x,y},gear:{id,base:'bow',name:'穿云弓',slot:'weapon',attack:7,armor:0,effect:'none',rank:0,locked:false,quality,affixes:[]}});
it('collects reachable nearby drops by value without crossing walls or regions',()=>{
 const common=reward('common'),rare=reward('rare',12,10,'rare'),far=reward('far',17),other={...reward('other'),region:'forest'};
 expect(nearbyLoot([common,far,other,rare],region,hero).map(r=>r.id)).toEqual(['rare','common']);
 expect(nearbyLoot([rare],{...region,obstacles:[{x:11,y:9,w:.5,h:2}]},hero)).toEqual([]);
});
it('fans stacked real item icons without changing their pickup positions',()=>{
 const drops=Array.from({length:6},(_,i)=>reward(String(i)));const layout=lootLayout(drops);
 expect(new Set(layout.map(p=>p.x+':'+p.y)).size).toBe(6);expect(drops.every(r=>r.position.x===11&&r.position.y===10)).toBe(true);
 expect(groundLootArt(drops[0])).toBe('/art/ui-v2/weapon-bow/gear-bow.png');
});
it('uses dedicated chibi icons for every runtime template without substituting unrelated parts',()=>{
 const drop=reward('fixture');
 for(const base of ['blade','coat','omega-blade','primal-blade','omega-bow','bow','charm','core','shield'])expect(groundLootArt({...drop,gear:{...drop.gear,base}})).toBe('/art/ui-v2/'+(base.endsWith('bow')?'weapon-bow':'items-chibi')+'/gear-'+base+'.png');
});

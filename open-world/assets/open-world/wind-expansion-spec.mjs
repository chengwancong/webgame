/** M2 wind-island additions, authorised in the W4 handoff. Existing complete
 * actors are adapted with declared material/scale; no new skeleton claim. */
export const windExpansionVersion='wind-m2-art-20261007-v1';
export const windZones=['落风坡','船台湾','风车高地','旧码头','岸线崖','船坞要塞'];
const material={tint:'#dae4bb',wash:{color:'#d9d4b6',alpha:.1}};
export const windCombatActors=[
 {id:'ow-mon-wind-1',name:'风原巡猎兽',base:'ss-mon-wind-hound',category:'monster',displayHeight:80,material},
 {id:'ow-mon-wind-2',name:'暮界船台匪兵',base:'ss-mon-dock-scavenger',category:'monster',displayHeight:90,material},
 {id:'ow-elite-wind',name:'暮界船坞督哨',base:'ss-elite-hook-leader',category:'elite',displayHeight:110,material},
 ...['岩岸船钩守卫','残骸吊索守卫','要塞航契守卫'].map((name,i)=>({id:`ow-boss-wind-${i+1}`,name,base:'ss-boss-port-vanguard',category:'dungeon-boss',displayHeight:[150,165,140][i],material:{tint:['#dcc5a6','#bfd2c0','#d4c6ad'][i],wash:{color:['#c5ac89','#95b3a4','#b4a98c'][i],alpha:.12}}})),
 {id:'ow-rare-wind-1',name:'逐风的巨钩',base:'ss-elite-hook-leader',category:'rare',displayHeight:143,material:{tint:'#e7d3ac',wash:{color:'#f0bf4f',alpha:.15}},aura:true},
 {id:'ow-rare-wind-2',name:'失铃的长牙',base:'ss-mon-wind-hound',category:'rare',displayHeight:104,material:{tint:'#e7d3ac',wash:{color:'#f0bf4f',alpha:.15}},aura:true},
];
const people=[
 ['牧羊少年·小穗','archer_common2','headA2','hairA_b2','milo'],
 ['船匠·老戈','warrior_common1','headB2','hairB_c6','tongling'],
 ['磨坊主·芦婶','cleric_common2','headA2','hairA_a8','qingmang'],
 ['拾荒者·阿灰','rogue_common1','headB2','hairA_b3','mijia'],
 ['灯塔看守·衡','knight_common2','headB2','hairB_b8','xuemi'],
 ['暮界逃兵·莱恩','cleric_uncommon1','headA2','hairA_a2','jinyu'],
];
export const windRegionalNpcs=people.map(([name,body,head,hair,kit],i)=>({id:`ow-npc-wind-${i+1}`,name,zone:windZones[i],skins:['BODY/'+body,'HEAD/'+head,'HAIR/'+hair],kit,category:'regional-npc',material}));
export const windBannerBases=['ow-art-tree-oak','ow-art-pier','ow-art-windmill','ow-art-wreck','ow-art-lighthouse','ow-art-fort-gate'];
export const windExtraSprites=[
 {id:'ow-art-wind-entrance-3',name:'船坞地城入口',base:'ow-art-cave-entry',category:'entrance',displayWidth:195,material:{tint:'#d8c49f',wash:{color:'#d0b68b',alpha:.12}}},
 {id:'ow-art-wind-boss-gate',name:'船坞首领门',base:'ow-art-fort-gate',category:'boss-gate',displayWidth:250,material:{tint:'#e4d3ad',wash:{color:'#c4b07c',alpha:.14}}},
];
export const windExpansionRequired={monster:2,elite:1,rare:2,'dungeon-boss':3,'regional-npc':6,'zone-banner':6};

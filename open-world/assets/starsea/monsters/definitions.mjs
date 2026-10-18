// Monster production definitions. This module does not change gameplay templates.
const paint=(body,head,hair,right,left)=>({kind:'mini42',skins:[`BODY/${body}`,`HEAD/${head}`,...(hair?[`HAIR/${hair}`]:[]),...(right?[`RIGHTHAND/${right}`]:[]),...(left?[`LEFTHAND/${left}`]:[])],actions:{idle:'Wait1',move:'Run1',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Attack_OneHand2'},ground:[-.25,0],nativeFacing:-1,tints:{}});
const tool=(asset,bone,width,height,x,y,pivot=[.5,.92],rotation=0)=>({asset,bone,width,height,x,y,pivot,rotation});
export const definitions={
 'ss-mon-dusk-blade':{...paint('knight_uncommon2','headA4','hairA_a8','Sword_OneHand_Common1'),tints:{top:'b0a2cfff',arm_L:'c9ced9ff',arm_R:'c9ced9ff',cloak:'9d8bc4ff'}},
 'ss-mon-dusk-gunner':{kind:'sp33',source:'assets/actors/huoqiang',base:'hero_huoqiang',nativeFacing:1,tints:{},adjustments:['Original short-rifle, goggles and backpack silhouette; native 3.6.32 complete animation.']},
 'ss-mon-dusk-weaver':{...paint('wizard_epic2','headB4','hairA_c8','Staff_Epic4'),actions:{idle:'Wait3',move:'Run3',attack:'Spell1',hurt:'Damage2',death:'Die',skill:'Spell2'},tints:{top:'b1a4ceff',cloak:'a393bfff',RIGHTHAND:'c4b9e9ff'}},
 'ss-mon-wind-hound':{kind:'sp33',source:'assets/actors/xiaolang',base:'hero_xiaolang',texture:'sources/wind-atlas.png',nativeFacing:1,adjustments:['Imagegen preserved original UV layout; cream-tan fur, cyan/brass guards. Original four-leg skeleton and six complete actions.']},
 'ss-mon-dock-scavenger':{...paint('warrior_common2','headA1','hairB_a5'),overlays:[tool('dock-hook','RIGHTHAND',70,180,0,0)]},
 'ss-mon-moss-warden':{...paint('knight_common2','headA3',null,'Sword_OneHand_Common2','Shield_Small_Common1'),actions:{idle:'Wait2',move:'Run2',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Guard1'},tints:{top:'aecc87ff',arm_L:'bac79cff',arm_R:'bac79cff',shield_L:'75a75dff'}},
 'ss-mon-pollen-caller':{...paint('cleric_uncommon1','headB1','hairB_b5','Staff_Common3'),actions:{idle:'Wait3',move:'Run3',attack:'Spell1',hurt:'Damage2',death:'Die',skill:'Cast1'},tints:{top:'b8d283ff',cloak:'94b16cff',RIGHTHAND:'ddb477ff'}},
 'ss-mon-ember-worker':{...paint('warrior_rare2','headA5',null),hide:['head'],overlays:[tool('engine-mask','head',94,89,0,40,[.5,.5]),tool('forge-pliers','RIGHTHAND',65,120,0,0)],tints:{top:'a3a3aaff',arm_L:'b7a18fff',arm_R:'b7a18fff'},actions:{idle:'Wait1',move:'Run1',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Spell1'}},
 'ss-mon-ore-loader':{...paint('knight_epic1','headA1',null,null,'Shield_Large_Common2'),hide:['head'],overlays:[tool('engine-mask','head',106,100,0,43,[.5,.5]),tool('forge-pliers','RIGHTHAND',80,170,0,0)],tints:{top:'c6b0a2ff',arm_L:'c6b0a2ff',arm_R:'c6b0a2ff',shield_L:'ccae83ff'},actions:{idle:'Wait2',move:'Run2',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Guard2'}},
 'ss-mon-frost-hound':{kind:'sp33',source:'assets/actors/xiaolang',base:'hero_xiaolang',texture:'sources/frost-atlas.png',nativeFacing:1,boneScale:{bone4:[1.1,1.05],bone5:[1,1.22],bone7:[1,1.22]},adjustments:['Imagegen preserved original UV layout; icy blue-white fur and silver-blue guards. Original four-leg skeleton and six complete actions.','Frost head and ear native bone scale changes create a stronger head/crest silhouette than the wind hound.']},
 'ss-mon-frozen-watch':{...paint('knight_rare2','headA6',null,'Spear_OneHand_Rare1','Shield_Small_Rare1'),hide:['head'],overlays:[tool('engine-mask','head',98,93,0,40,[.5,.5])],actions:{idle:'Wait2',move:'Run2',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Attack_OneHand2'},tints:{top:'b8d7f2ff',arm_L:'b8d7f2ff',arm_R:'b8d7f2ff',shield_L:'a1d2ffff'}},
 'ss-mon-rift-lurker':{...paint('rogue_uncommon2','headA4','hairA_b8','Dagger_Uncommon3','Dagger_Uncommon2'),actions:{idle:'Wait4',move:'Run4',attack:'Attack_DualHand1',hurt:'Damage2',death:'Die',skill:'Attack_DualHand2'},tints:{top:'b4a2ccff',cloak:'9b86b6ff',RIGHTHAND:'c4becfff',LEFTHAND:'c4becfff'}},
 'ss-mon-rift-caller':{...paint('wizard_rare2','headB4','hairB_c9','Scepter_Epic3'),actions:{idle:'Wait3',move:'Run3',attack:'Spell1',hurt:'Damage2',death:'Die',skill:'Cast2'},tints:{top:'ddd9efff',cloak:'c5bcdeff',RIGHTHAND:'bd94dfff'}},
 'ss-mon-bone-sentinel':{...paint('knight_legendary1','headA1',null,'Sword_OneHand_Rare4','Shield_Small_Rare3'),overlays:[tool('dragon-horns','head',104,43,0,0,[.5,.5])],actions:{idle:'Wait2',move:'Run2',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Guard1'},tints:{shield_L:'8ecbd0ff',top:'f0e1baff'}},
 'ss-mon-oath-acolyte':{...paint('cleric_epic1','headB1','hairB_c1','Staff_Common4'),actions:{idle:'Wait3',move:'Run3',attack:'Spell1',hurt:'Damage2',death:'Die',skill:'Spell2'},tints:{top:'dfeae2ff',cloak:'b3dcdbff',RIGHTHAND:'c1e2deff'}},
 'ss-elite-hook-leader':{...paint('warrior_epic2','headA3','hairA_a5'),overlays:[tool('dock-hook','RIGHTHAND',98,240,0,0)],tints:{top:'f3b58aff',cloak:'cc996fff',arm_L:'ecb887ff',arm_R:'ecb887ff'}},
 'ss-elite-vine-keeper':{...paint('knight_epic2','headA3','hairA_c6','Sword_OneHand_Common3','Shield_Large_Common3'),actions:{idle:'Wait2',move:'Run2',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Guard2'},tints:{top:'b8cb8aff',cloak:'b2a478ff',arm_L:'c1c591ff',arm_R:'c1c591ff',shield_L:'8bbb78ff'}},
 'ss-elite-forge-overseer':{...paint('warrior_legendary2','headA5',null,null,'Shield_Large_Epic2'),hide:['head'],overlays:[tool('engine-mask','head',115,108,0,45,[.5,.5]),tool('forge-pliers','RIGHTHAND',105,230,0,0)],actions:{idle:'Wait2',move:'Run2',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Spell2'},tints:{top:'d8ae8bff',arm_L:'dbab7fff',arm_R:'dbab7fff',shield_L:'e1b37fff'}},
 'ss-elite-frost-lock':{...paint('knight_legendary2','headA6',null,'Spear_OneHand_Epic2','Shield_Large_Rare2'),hide:['head'],overlays:[tool('engine-mask','head',103,98,0,42,[.5,.5])],actions:{idle:'Wait2',move:'Run2',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Guard2'},tints:{top:'c0d8f0ff',arm_L:'b2d1edff',arm_R:'b2d1edff',shield_L:'b4d2ffff'}},
 'ss-elite-rift-hunter':{...paint('rogue_epic2','headA4','hairA_c8','Dagger_Epic2','Dagger_Epic4'),actions:{idle:'Wait4',move:'Run4',attack:'Attack_DualHand1',hurt:'Damage2',death:'Die',skill:'Attack_DualHand2'},tints:{top:'bcaad8ff',cloak:'a894c9ff',arm_L:'bdabdaff',arm_R:'bdabdaff'}},
 'ss-elite-oath-keeper':{...paint('knight_legendary2','headA1','hairA_c1','Scepter_Legendary3','Shield_Large_Legendary3'),overlays:[tool('dragon-horns','head',120,50,0,0,[.5,.5])],actions:{idle:'Wait2',move:'Run2',attack:'Attack_OneHand1',hurt:'Damage1',death:'Die',skill:'Spell2'},tints:{top:'f4e7caff',arm_L:'eee0bfff',arm_R:'eee0bfff',shield_L:'9fd8daff'}}
};
export const generatedSources={
 'wind-atlas':'exec-3d17ca08-5f77-4a1c-a816-485ed8e9edb1.png',
 'frost-atlas':'exec-c5c61bb6-623e-4db9-bdc3-8fcc29557b02.png',
 'dock-hook':'exec-ab9e9663-60cb-4b67-b201-ddf040444450.png',
 'engine-mask':'exec-eaea03b6-fb1c-4296-b8cd-59317f2ebe7f.png',
 'dragon-horns':'exec-b8930230-6b36-4ee0-a730-fc1c8783b2d1.png',
 'forge-pliers':'exec-e10ecc04-1851-4992-b857-097150842346.png',
 'ember-core':'exec-598db9f2-c0c0-41b7-9937-a6bc9608cbd0.png',
 'seed-pouch':'exec-115e94c3-ee3f-46bd-babf-22ca7e6e8cb5.png',
 'dusk-clasp':'exec-7976f2da-a3ba-47bc-91ea-a22a70820c09.png'
};
for(const [id,d] of Object.entries(definitions)){
 if(d.kind!=='mini42')continue;
 let tone;if(/dusk|rift/.test(id))tone='39284fff';else if(/moss|pollen|vine/.test(id))tone='283d20ff';else if(/frozen|frost/.test(id))tone='253c60ff';else if(/bone|oath/.test(id))tone='354440ff';
 if(tone)d.darkTints=Object.fromEntries(Object.keys(d.tints).filter(k=>['top','cloak','arm_L','arm_R','shield_L'].includes(k)).map(k=>[k,tone]));
}
for(const id of ['ss-mon-ember-worker','ss-mon-ore-loader','ss-elite-forge-overseer'])definitions[id].overlays.push({...tool('ember-core','spine2',38,36,-8,-7,[.5,.5]),slot:'neck'});
definitions['ss-mon-pollen-caller'].overlays=[{...tool('seed-pouch','spine2',44,57,27,-19,[.5,.5]),slot:'neck'}];
// Original head/spine2 axes point upward (90 degrees), not horizontally. Art is painted upright.
for(const d of Object.values(definitions))for(const o of d.overlays??[])if(['head','spine2'].includes(o.bone)){
 const worldX=o.x,worldY=o.y;o.x=worldY;o.y=-worldX;o.rotation-=90;
}
for(const id of ['ss-mon-dusk-blade','ss-mon-dusk-weaver']){
 const d=definitions[id];d.overlays??=[];d.overlays.push({...tool('dusk-clasp','spine2',36,40,-8,12,[.5,.5],-90),slot:'neck'});
 d.tints.lining='aaa1cfff';d.darkTints.lining='39284fff';
}
Object.assign(definitions['ss-mon-dusk-gunner'],{overlays:[{asset:'dusk-clasp',slot:'tx/2',bone:'bone2',width:60,height:66,calibrationWorldOffset:[-78,115]}],tints:{pifeng:'b6adcfff',qugan:'b6adcfff',youjianjia:'dfdaecff',zuobi:'cac4deff'},darkTints:{pifeng:'39284fff',qugan:'39284fff',youjianjia:'30243fff',zuobi:'30243fff'}});
for(const id of ['ss-mon-bone-sentinel','ss-elite-oath-keeper']){
 const d=definitions[id];d.overlays[0].fitToRegion={slot:'head',visiblePoint:[.5,.16],accessoryPoint:[.5,.62]};
 d.adjustments=['Dragon headwear repair: original HEAD/headA1/head visible atlas trim is the attachment calibration source; painted horn roots overlap the forehead, independent of screen/canvas position.'];
}

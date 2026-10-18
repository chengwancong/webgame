/** Resource authoring only. Gameplay coordinates and NPC services belong to 世界.xlsx / NPC.xlsx. */
export const version='open-world-art-20261006-v1';
export const reference='.design/npc-scene-unification-20261003/camp-unified-v2.png';
const sprite=(id,name,source,width,category,extra={})=>({id:'ow-art-'+id,name,source,displayWidth:width,category,kind:'sprite',...extra});
const own=(id,name,width,category,extra={})=>sprite(id,name,'assets/open-world/source/'+id+'.png',width,category,{sourceMode:'imagegen',...extra});
const old=(id,name,source,width,category,extra={})=>sprite(id,name,'apps/web/public'+source,width,category,{sourceMode:'reuse',...extra});
export const assets=[
 own('windmill','风车高地 · 风车',230,'landmark'),
 own('lighthouse','岸线崖 · 灯塔',170,'landmark'),
 own('wreck','旧码头 · 搁浅船骸',300,'landmark'),
 old('pier','船台湾 · 木栈桥','/art/starsea/scenes/sprites/pier.png',290,'landmark'),
 own('fort-gate','船坞要塞 · 木石闸门',280,'landmark'),
 own('tent','营地帐篷',150,'camp'),
 own('campfire','营地篝火',70,'camp'),
 own('fence','营地木栅',130,'camp'),
 own('totem','营地图腾',65,'camp'),
 old('cargo','营地货箱','/art/starsea/props/ss-prop-cargo.png',80,'camp'),
 own('flag','营地旗帜',65,'camp'),
 old('repair-table','前哨修理台','/art/environment/handdrawn/props.png',125,'outpost',{atlasFrame:'forge'}),
 old('supply-crate','前哨补给箱','/art/starsea/props/ss-prop-cargo.png',90,'outpost'),
 own('anchor-beacon','航标锚石',70,'travel',{states:['inactive','active'],statePolicy:'one-physical-body-plus-program-light'}),
 old('tree-oak','圆冠橡树','/art/starsea/scenes/sprites/oak.png',140,'nature'),
 own('tree-pine','海岸松树',135,'nature'),
 own('tree-wind','风弯小树',130,'nature'),
 own('tree-birch','白干阔叶树',130,'nature'),
 own('bush','圆叶灌木',70,'nature'),
 own('bush-berry','浆果灌木',70,'nature'),
 own('bush-reed','海岸芦苇',70,'nature'),
 own('flowers','海风花草',55,'nature'),
 own('flowers-blue','蓝铃花',55,'nature'),
 own('flowers-gold','金盏花',55,'nature'),
 own('flowers-grass','海岸草丛',55,'nature'),
 old('rocks','草坡石堆','/art/starsea/scenes/sprites/rocks.png',85,'nature'),
 own('rocks-flat','平岩石板',85,'nature'),
 own('rocks-stack','三石堆',85,'nature'),
 own('rocks-moss','苔藓圆石',85,'nature'),
 own('rocks-split','裂缝双石',85,'nature'),
 own('boulder','岸线大山石',160,'nature'),
 own('boulder-spire','岸线尖岩',160,'nature'),
 own('boulder-arch','天然石拱',160,'nature'),
 own('boulder-ledge','叠层岩台',160,'nature'),
 own('cave-entry','岩岸洞口',180,'entrance'),
 own('watchtower','前哨木哨塔',190,'building'),
 old('cliff','风栖岛缘','/art/starsea/scenes/sprites/cliff.png',260,'boundary'),
 old('portal-entry','共用传送门','/art/environment/handdrawn/props.png',175,'entrance',{atlasFrame:'portal'}),
 old('chest-closed','补给宝箱 · 合盖','/art/starsea/props/ss-prop-cargo.png',75,'chest',{state:'closed'}),
 old('chest-open','补给宝箱 · 开盖','/art/starsea/props/ss-prop-cargo-opened.png',75,'chest',{state:'opened'}),
 {id:'ow-art-grass',name:'落风坡草地',kind:'ground',category:'ground',source:'assets/environment-handdrawn/originals/grass.png',sourceMode:'reuse',sampling:'mirrored-repeat'},
 {id:'ow-art-stone',name:'船坞石地',kind:'ground',category:'ground',source:'assets/environment-handdrawn/originals/road.png',sourceMode:'reuse',sampling:'mirrored-repeat'},
 {id:'ow-art-sand',name:'船台湾沙地',kind:'ground',category:'ground',source:'assets/open-world/source/sand.png',sourceMode:'imagegen',sampling:'mirrored-repeat'},
 {id:'ow-art-dirt',name:'风车高地土路',kind:'ground',category:'ground',source:'assets/open-world/source/dirt.png',sourceMode:'imagegen',sampling:'mirrored-repeat'},
 {id:'ow-art-planks',name:'旧码头木板地',kind:'ground',category:'ground',source:'assets/open-world/source/planks.png',sourceMode:'imagegen',sampling:'mirrored-repeat'},
];
export const masks=['east','west','north','south','radial','radial-inverse','corner-ne','corner-sw'];
export const actors=[
 {id:'ow-npc-supply',name:'前哨补给员',skins:['BODY/archer_common2','HEAD/headA2','HAIR/hairA_b2'],role:'supply',kit:'qingmang'},
 {id:'ow-npc-repair',name:'前哨修理员',skins:['BODY/warrior_common1','HEAD/headB2','HAIR/hairB_c6'],role:'repair',kit:'tongling'},
 {id:'ow-npc-storage',name:'前哨仓库员',skins:['BODY/cleric_common1','HEAD/headB2','HAIR/hairB_b2'],role:'storage',kit:'cheng'},
];
export const outstanding=[
 '六主题全量分区地表、道路、岛缘与自然物件池。',
 '其余五岛及风栖岛分区扩充地标，目标90–120个独特大物件；当前5个样板不能按摆放次数扩充计数。',
 '12种扩充建筑、六主题18个地城入口、精良宝箱和事件物件。',
 '12种新普通怪、6名新精英、18个地城首领、40–60名区域人物及4类主线演出动作。',
 '剧情门开关状态、六座首领门和事件动态特效；已交付的全图标记、迷雾遮罩和传送表现等待系统绑定。',
];

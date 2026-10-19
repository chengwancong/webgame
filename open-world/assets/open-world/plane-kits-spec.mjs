import {readFileSync} from 'node:fs';
import {propItems} from './plane-kits/props-contract-spec.mjs';
import {rolloutItems,statePrompt} from './plane-kits/rollout-spec.mjs';
const propContracts=JSON.parse(readFileSync(new URL('../../packages/asset-manifest/open-world-planes-greybox.v1.json',import.meta.url),'utf8')).assets;
export const planeVersion='open-world-planes-20261018-v1';
export const contract=JSON.parse(readFileSync(new URL('./plane-kits/id-contract.json',import.meta.url),'utf8'));
for(const p of rolloutItems)if(!contract.assets.some(a=>a.id===p.id))contract.assets.push({id:p.id,name:p.name,kit:p.kit,island:p.island,part:p.part,kind:'ground',category:'ground',states:p.states,placeholderAssetId:'ow-art-stone'});
export const kitNames={cave:'洞穴',crypt:'地宫',maze:'废弃迷宫',vault:'秘室',rift:'裂隙',entry:'野外入口',fx:'特效'};
export const kitThemes={cave:'浅褐湿岩、钟乳石、发光蓝晶、暖色火把',crypt:'浅灰石砖、描金纹饰、柱列、石棺、蓝色长明灯',maze:'灰绿苔墙、藤蔓、碎瓦、断拱与温暖天光',vault:'奶白石砖、暖金宝光、黄铜齿轮与精巧机关',rift:'浅紫悬浮岩岛、星屑、青蓝晶石、明亮星海'};
export const featureThemes={
 wind:{cave:['风蚀螺旋石笋','牧羊矿篮'],crypt:['麦穗纹矮棺','风羽石灯'],maze:['断叶风车轴架','羊铃藤门残段'],vault:['风车齿轮机关','羊毛货箱']},
 mist:{cave:['铃铛菌簇','根缠滴水石槽'],crypt:['苔封信使石匣','铜铃长明灯'],maze:['铃架残骸','雾灯'],vault:['密信锁箱台','三铃转轮机关']},
 forge:{cave:['熔渣管','冷却池'],crypt:['铜管石棺','炉纹供灯台'],maze:['冷凝管断墙','锈齿检修桥残段'],vault:['压力齿轮保险台','铜锭输送匣']},
 frost:{cave:['冰镜滴柱','冻缆矿篮'],crypt:['冰封石棺','霜灯'],maze:['冰封舷窗断墙','霜藤观测架'],vault:['星镜锁盘','冰锚宝匣']},
 rift:{cave:['悬空晶根','星潮滴石盆'],crypt:['星骸铭文匣','悬浮守夜灯'],maze:['失重供能断墙','裂晶导流架'],vault:['星潮校准齿轮','虚空密封匣']},
 dragon:{cave:['龙肋矿晶簇','骨纹温泉盆'],crypt:['誓约翼纹石棺','龙角长明灯'],maze:['古航翼架残段','誓文骨墙'],vault:['龙翼机械锁','航网核心匣']}
};
const names={'ground-main':'主地表','ground-detail':'细节地表','ground-path':'通路','ground-rubble':'碎石斑块','wall-straight':'直墙','wall-inner':'内角墙','wall-outer':'外角墙','wall-break':'断墙','wall-top':'墙顶','edge-front':'前崖口','edge-side':'侧崖口','edge-corner':'崖角','edge-under':'悬垂岩根',pillar:'矮柱',arch:'拱门',passage:'阶梯通道',seal:'封石',mouth:'巢口',light:'底座灯','light-pool':'柔光地贴',lever:'拉杆',plate:'压板','lore-stone':'残片石碑','backdrop-near':'近层岩壁远景','backdrop-far':'远层天光远景','backdrop-starsea':'星海远景','backdrop-tide-band':'星潮光带','backdrop-cloud':'远岛云层',gate:'地面裂隙',anchor:'守护锚石',crystal:'星晶','cave-mouth':'岩洞入口','crypt-door':'地宫墓门','maze-gate':'苔墙迷宫门','cracked-wall':'细裂岩壁秘门','vine-curtain':'藤幕秘门','well-cover':'井盖秘门','bone-gate':'圆润古骨首领门','thorn-cave':'荆藤岩洞','link-stone':'贯通界石','portal-base':'出口传送门底座'};
const propThemes={cave:['钟乳岩柱','蓝晶巨簇','矿车残骸','湿岩堆','断矿轨','低矮石笋','晶矿筐','蓝晶碎块','圆卵石','滴水石','矿灯'],crypt:['描金石棺','残缺祭柱','碑墙残段','柱础','石供盆','碎碑','方形灯台','石砖堆','铭文碎片','小供杯','石铃'],maze:['倒塌石拱','藤架','苔墙残段','碎瓦堆','苔石台','断栏','枯井台','藤芽','陶片堆','圆苔石','碎砖'],vault:['宝箱台','大齿轮机关','封印柱','金砖堆','齿轮座','封印盘','铜制秤台','散落齿轮','小金锭','机关销','宝石匣']};
const propKeys=['l1','l2','l3','m1','m2','m3','m4','s1','s2','s3','s4'];
export const planeAssets=contract.assets.map(a=>{
 const inheritedRoll=rolloutItems.find(p=>p.id===a.baseId);
 if(inheritedRoll)return {...a,sourceMode:'registered-material-adaptation',source:`assets/open-world/plane-kits/source/rollout/${a.baseId}.png`,canvas:inheritedRoll.contract.canvas,anchor:inheritedRoll.contract.anchor,displayWidth:inheritedRoll.contract.displayWidth,contract:inheritedRoll.contract};
 const roll=rolloutItems.find(p=>p.id===a.id);
 if(roll){const sprite=['R2','R4'].includes(roll.batch),mask=roll.part==='light-pool',kind=sprite?'sprite':mask?'mask':roll.part==='backdrop-near'?'ambient':'ground';const result={...a,name:roll.name,subject:roll.name,placeholderAssetId:a.placeholderAssetId??'ow-art-stone',sourceMode:'imagegen',source:roll.states.length>1?roll.sources[roll.states[0]].replace('-'+roll.states[0]+'.png','.png'):roll.sources.default,states:roll.states,kind,category:sprite?'nature':mask?'mask':kind==='ambient'?'ambient':'ground',canvas:roll.contract.canvas,anchor:roll.contract.anchor,displayWidth:roll.contract.displayWidth,contract:roll.contract};delete result.baseId;delete result.material;return result;}
 const prop=propItems.find(p=>p.id===a.id);
 if(prop){const c=propContracts.find(g=>g.id===a.id).contract;return {...a,name:prop.name,subject:prop.subject,sourceMode:'imagegen',source:prop.source,canvas:c.canvas,anchor:c.anchor,displayWidth:c.displayWidth,contract:c};}
 let subject=names[a.part]??a.part;
 if(a.part.startsWith('feature-'))subject=featureThemes[a.island][a.kit][Number(a.part.at(-1))-1];
 if(a.part.startsWith('prop-'))subject=propThemes[a.kit][propKeys.indexOf(a.part.slice(5))];
 if(a.part.startsWith('shard-'))subject=['三棱星石碎片','弯月星石碎片','扇形星石碎片'][Number(a.part.at(-1))-1];
 if(a.part.startsWith('floating-rock-'))subject=Number(a.part.at(-1))===1?'悬浮扁平岩块':'悬浮竖长岩块';
 const displayWidth=({ground:256,boundary:260,building:220,entrance:185,ambient:2048,mask:180})[a.category]??(a.part.startsWith('prop-s')?80:a.part.startsWith('prop-m')?125:160);
 return {...a,name:`${kitNames[a.kit]} · ${subject}`,subject,displayWidth,sourceMode:a.baseId?'registered-material-adaptation':'imagegen',source:`assets/open-world/plane-kits/source/${a.id}.png`,canvas:a.kind==='ground'?[512,512]:a.kind==='ambient'?[2048,768]:[528,528],anchor:a.kind==='ground'?[0,0]:a.kind==='ambient'?[0,1]:a.category==='boundary'?[.5,.35]:a.category==='mask'?[.5,.5]:[.5,520/528]};
});
export const style='奶白浅金、明亮卡通手绘，圆润大轮廓、少量清晰色面、柔和深色描边，左上柔光，暗部为蓝紫或灰绿；等距投影[32,18]，同五岛户外美术；不恐怖、不用大面积深棕或纯黑，不写字，不加水印。';
const stateText={closed:'闭合封住入口',open:'打开露出通道或裂开，保留底座位置',off:'手柄未拉下',on:'手柄已拉下',up:'压板抬起',down:'压板按下',active:'裂隙开启，浅青蓝核心',cooldown:'冷却时微弱余辉',idle:'完整守护核心',damaged:'外壳局部开裂，核心仍完整',unsettled:'未平定，灯未亮、浅爪痕',cleared:'已平定，暖火把点亮、爪痕消失、少量花草',hidden:'秘密隐藏，普通外表只有细微线索',found:'秘密发现，破开并露出小门洞',sealed:'界石封闭',dormant:'底座休眠',default:'默认完整造型'};
export function promptFor(a,state){
 const roll=rolloutItems.find(p=>p.id===a.id);if(roll)return {id:a.id,state,tool:'内置image_gen',useCase:'stylized-concept',transparent_background:['R2','R4'].includes(roll.batch)||roll.part==='light-pool',output:roll.sources[state],prompt:statePrompt(roll,state),status:'queued'};
 const prop=propItems.find(p=>p.id===a.id);
 if(prop)return {id:a.id,state,tool:'内置image_gen',useCase:'stylized-concept',transparent_background:true,output:prop.source,prompt:prop.prompt,status:'queued'};
 const material={cave:'温暖浅米褐石灰岩',crypt:'奶白浅灰石砖，极少浅金纹饰',maze:'浅灰绿石砖、稀疏柔绿苔痕',vault:'奶白石砖与浅金黄铜',rift:'浅紫灰岩、青蓝晶质'}[a.kit]??'奶白浅金石材';
 let prompt;
 if(a.kind==='ground')prompt=`游戏地面材质贴图，严格正上方90度俯视，满幅平面纹理。材质：${material}。用途：${a.subject}。${a.part==='ground-rubble'?'细碎扁平石屑均匀散布，全部贴地。':a.part==='ground-detail'?'细小裂痕与轻微湿润色差，无大块图形。':a.part==='ground-path'?'平整踩实的细碎石土，平缓均匀。':'大块平滑天然浅石面，低对比细缝。'} 明亮手绘卡通、奶白浅金基调、简洁色面，均匀漫射光，无定向投影。整张图片是同一种平整可行走表面，不画任何立体东西、钟乳石、水晶、火把、墙、台阶、悬崖或建筑。不画场景、不画等距地块、不画边框。四边材质连续，供mirrored-repeat地表采样。`;
 else prompt=`只生成一个独立游戏资源：${a.subject}，状态${stateText[state]}。材质：${material}。${style} ${a.kind==='ambient'?'只画宽幅远景这一层，2048×768比例；左右形状与颜色连续可横向平铺，无近景物件。':a.kind==='mask'?'只画纯白到透明的柔光椭圆，无其他颜色、底座或硬边，真正透明背景。':'孤立单个物件，真正透明背景，完整轮廓，四周留出8%以上透明空间，无环境、无底图、无文字、无其他物件。'} ${a.category==='boundary'?'模块等距顶面斜率32:18；与同系列模块保持相同厚度、比例与接地线，端部适合16px搭接。':''} ${a.states.length>1?'固定全画布和缩放与枢轴，只改变状态内容；编辑时所有未变化部位必须留在原像素位置。':''} 不是场景插画，不是联系表。`;
 if(a.kind==='mask')prompt='生成一张纯白色柔光遮罩：一个平滑椭圆形的白色到完全透明渐变，中心半透明白，向外连续衰减至透明。真正透明背景。所有非透明像素颜色都只为中性白色，不带黄、金、蓝或其他色相；没有环线、没有轮廓线、没有实物、没有星星、没有噪点。四周留足透明空间。只作为游戏灯光叠加遮罩，色彩由运行材质指定。';
 else if(a.kind==='ambient')prompt+=` 明确场所：${kitThemes[a.kit]}。${a.kit==='cave'?'是地下洞内远层，圆润的远处钟乳岩和幽浅蓝灰洞室，不是户外天空、城堡或海岸。':''} 不要对称中心主体，左右边缘颜色与高度严格连续。`;
 else if(a.kind!=='ground')prompt+=' 物件实际材质按用途：木车是木和铁，水晶是青蓝晶体，灯有光；不要把所有摆件画成石雕。';
 return {id:a.id,state,tool:'内置image_gen',useCase:'stylized-concept',transparent_background:!['ground','ambient'].includes(a.kind),output:a.source.replace('.png',a.states.length>1?`-${state}.png`:'.png'),prompt,status:'queued'};
}

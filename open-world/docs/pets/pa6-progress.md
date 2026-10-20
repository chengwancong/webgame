
# PA6 · SP33 原生宠物全量替换

## 决策日志

- 工具目录采用默认 tools/pets/sp33/；原始帧、截图、备份与明细只放 .design/pet-sp33-rollout/，该目录整体忽略git。
- 最新用户指令优先：julongzisi（含_1同家族）仅用于第1批工具回归，不纳入最终18家族；龙眠重氪另选，最终需要导出18个新家族，而不是17。
- assets/actors中的全部已占用家族及其_1版本排除；不重画、不调色、不改骨骼/时序。
- 保留162个皮肤身份、名称、职业/流派、palette、挂件和特效身份/规格；只更新family及必要挂点offset。
- 样板materials.encoding文字写成24位，但实际文件与现有composer均使用RG16索引+B8覆盖率。本批按真实样板字节协议输出，并修正描述字段为RG16_LE_INDEX_B8_COVERAGE_OPAQUE，不改composer。

## 第1批：开始

已通读需求全文和四个样板文件；已备份v3目录与源manifest。开始配置化工具及julongzisi回归。


第1批工具回归：163帧，挂点最大误差0px，参考像素高差0。临时导出在.design/pet-sp33-rollout/exports/regression/，不写入最终家族。

## 第1批：完成

工具 tools/pets/sp33/ 已配置化；岚鳞回归163帧、挂点误差0px；共享包置于本地临时目录，通过现有composer的虚拟manifest执行 pa4.validate()：2430/2430，无空帧、无控制台错误。正式v3尚未写入julongzisi。

## 第2批：开始

开始按真实拼装画面和动作清单确定18个互不重复的家族；工具冒烟检查已生成原色候选总表，缺Movement/Run/Walk者排除。

## 第2批：完成

全库284份binary读取成功，排除占用后79个去重家族具有移动等必要动作；已逐一目视原生拼装，排除人形/持械人形职业。最终18家族互不重复，6张候选图位于.design/pet-sp33-rollout/candidates-*.png（每档2候选、1×与2×、主角及巡猎兽）。

|岛|氪度|家族/生物|id前缀|理由|
|---|---|---|---|---|
|wind|free|xiaoyuniguai|ss-pet-wind-free|草原石灵；圆方体、短肢、苔叶，结构简单|
|wind|light|bingren|ss-pet-wind-light|悬浮晶体元素；按默认裁决放宽为冷风主题，尖晶与分离浮肢形成中档亮点|
|wind|heavy|jinlong|ss-pet-wind-heavy|羽翼长角龙；白羽与金冠，坐骑级轮廓|
|mist|free|xiaozhizhu|ss-pet-mist-free|沼地小蛛；圆腹短体，低阶轮廓|
|mist|light|yuniguai|ss-pet-mist-light|苔泥元素；宽肩岩体与绿色苔面|
|mist|heavy|jiutoushe|ss-pet-mist-heavy|沼泽多首蛇；多头和长颈明显升级|
|forge|free|xiaoemo|ss-pet-forge-free|小型火魔；赤色短躯、自然翼角，无武器|
|forge|light|emo|ss-pet-forge-light|熔岩魔牛；四足宽躯与大角，非人形|
|forge|heavy|dalong|ss-pet-forge-heavy|熔火巨龙；展开翼、长尾与红黑熔火结构|
|frost|free|bailong|ss-pet-frost-free|白色幼龙；圆头短躯、冷色原皮|
|frost|light|ejiao|ss-pet-frost-light|原生蓝色鲸鲨怪物；完整鱼类躯体与短肢，体型居中；船锚为原生武器，不改动|
|frost|heavy|gulong_1|ss-pet-frost-heavy|冰蓝骨龙；翼骨与角冠，_1冷蓝光更合主题|
|dragon|free|xiaolong|ss-pet-dragon-free|小型多首龙；短颈圆躯，保留幼兽感|
|dragon|light|lvlongwang|ss-pet-dragon-light|森林角龙；四足、角翼和绿色龙鳞|
|dragon|heavy|shenyuanjiutoulong|ss-pet-dragon-heavy|深渊九首龙；多颈翼冠的重阶结构，替代禁用的julongzisi|
|star|free|xiaoyuanling|ss-pet-star-free|小型夜灵；无腿悬浮、发光双眼，无职业武器|
|star|light|diyusantouquan|ss-pet-star-light|暗夜三首兽；黑紫原皮与三首亮点|
|star|heavy|heilong_1|ss-pet-star-heavy|星夜紫龙；巨翼和原生紫色角光，_1更贴夜光主题|

裁决：原草案yuanling实际是人形女性法师，剔除。风栖轻氪按§6放宽至冷风晶体元素bingren；霜镜轻氪选原生蓝色鲸鲨怪物ejiao，其鱼类躯体、短肢和原生船锚均保留，不隐藏非FX部件。小型悬浮夜灵与晶体元素按明确允许的元素精灵/小怪物类别选用，未用人类职业角色。

## 第3批：开始

五动作映射均有原生Celebrate和Movement，无需替代动作；开始30帧/家族的挂点与隐藏FX抽查。

## 第3批：完成

18家族全部具有Idle/Celebrate/Movement/Attack1/BeAttacked，映射无需替代。共540原生抽查帧、每帧五挂点，图在.design/pet-sp33-rollout/actions-*.png。逐只隐藏及本体光保留如下：

|家族|隐藏正则|保留的命名发光层（未单列时原贴图本体发光不变）|
|---|---|---|
|wind-free|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^dimian&#124;^xiaoshitou&#124;^stone$&#124;^zhuangji&#124;^quanfeng`|无独立命名；原贴图眼/体纹保留|
|wind-light|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|part4, part5, part7, part2, part1, part3, part6|
|wind-heavy|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^light6$`|无独立命名；原贴图眼/体纹保留|
|mist-free|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|无独立命名；原贴图眼/体纹保留|
|mist-light|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^pan&#124;^x_&#124;^atkc&#124;^atkx&#124;^dian&#124;^st[123]$&#124;^dl$&#124;^zhuan&#124;^s1_&#124;^Stone$`|无独立命名；原贴图眼/体纹保留|
|mist-heavy|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^xuhua&#124;^siwang/`|无独立命名；原贴图眼/体纹保留|
|forge-free|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|无独立命名；原贴图眼/体纹保留|
|forge-light|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|yanjing|
|forge-heavy|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|无独立命名；原贴图眼/体纹保留|
|frost-free|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|无独立命名；原贴图眼/体纹保留|
|frost-light|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^shuaxiao2$`|无独立命名；原贴图眼/体纹保留|
|frost-heavy|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^bowen&#124;^tangsanzang&#124;^hongdian&#124;^huanrao`|tou_g, youshou2_g|
|dragon-free|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|无独立命名；原贴图眼/体纹保留|
|dragon-light|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^shuye_`|无独立命名；原贴图眼/体纹保留|
|dragon-heavy|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|无独立命名；原贴图眼/体纹保留|
|star-free|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/`|无独立命名；原贴图眼/体纹保留|
|star-light|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^gongji4$&#124;^beiji[45]$&#124;^1$`|无独立命名；原贴图眼/体纹保留|
|star-heavy|`diying&#124;touying&#124;yinying&#124;^tx&#124;^texiao&#124;^jineng/&#124;^gongji/&#124;^xuli/&#124;^skill/&#124;^attack2/&#124;^koushui/&#124;^xuli&#124;^tuxi&#124;^yan[2-9]$&#124;^zidan&#124;^dilie&#124;^qiangguang&#124;^zihuo&#124;^diguang&#124;^guangdian&#124;^shadian&#124;^dian_&#124;^dianliu&#124;^huqi&#124;^texiao_xuli`|tx9, tx10, tx11, tx12, tx13, tx14, tx15, tx16, ttx9, ttx10, ttx11, ttx12, ttx13, ttx14, ttx15, ttx16, tou_0000, yan_0000, xiongjia_0000, houguangjie2, shuijing3|

## 第4批：开始

开始24fps逐家族串行导出与共享打包。按最新禁止复用julongzisi的要求，实际导出18个新家族；54形态保持原ID。

第三批复核修正：star-heavy的tx9–tx16是外围星屑，隐藏；ttx9–ttx16是贴附角/体纹的发光，保留。见glow-probe.png及更新后的actions-star-heavy.png。

## 第4批：完成

18家族 × 3形态 = 54 runtime；全家族共2713原生24fps采样帧。每家族只存一套actor/regions/codebook/atlas/sockets，54个profile指向18份共享数据；旧重复帧已从运行目录移至本地备份。

共享后99898789字节；按§6仅对9家族降至192物理格（256逻辑坐标透明补边，不改composer，referencePixelHeight≥1.3×最大高度），最终80032378字节（80.032MB）。仍超过50MB，依§6记录实际值，不算硬阻塞；未降帧率/删动作/改原图。

## 第5批：开始

开始162套皮肤的family更新、挂点/遮脸/面积与镜像核对，挂件和特效资源保持原有身份。

第四批追加无损打包：仅对RG16索引做RGB顺序重排，解码RGB与alpha均不变，未加大shift。采用1家族，索引节省110060字节；v3当前79922318字节。

第五批面积裁定：原图/挂件资源本身不变；为同时满足第5批≤15%要求，保留全部挂件ID、图片、类型、颜色、层级和anchor及全部特效参数，仅对63套超限皮肤的挂件displaySize按家族×职业统一收缩（目标最坏帧保守上界14.7%）。没有删挂件，也没有缩小本体。具体前后值在本地attachment-display-fit.json；其余仅调整offset以对齐颈胸/头顶/尾根。

## 第5批：完成

162套皮肤family已更新，全部原有挂件/特效图片与身份保留；定位偏移及超限显示比例调整已登记。逐岛27皮肤×3形态=81实例，共486实例对照在skins81-*.png。全部原生帧的挂件可见alpha面积复核≤15%，三形态按同比例缩放，面积比不变；镜像预览已核对。

## 第6批：开始

验收图已生成：acceptance-六岛.png、all-162.png、actions-18家族.png，以及8626原生/镜像截图。开始最终pa4.validate()和源文件/共享引用/色码/皮肤身份审计。


第1批工具回归：163帧，挂点最大误差0px，参考像素高差0。临时导出在.design/pet-sp33-rollout/exports/regression/，不写入最终家族。

## 第5批：完成

162套皮肤family已更新，全部原有挂件/特效图片与身份保留；定位偏移及超限显示比例调整已登记。逐岛27皮肤×3形态=81实例，共486实例对照在skins81-*.png。全部原生帧的挂件可见alpha面积复核≤15%，三形态按同比例缩放，面积比不变；镜像预览已核对。

## 第6批：开始

验收图已生成：acceptance-六岛.png、all-162.png、actions-18家族.png，以及8626原生/镜像截图。开始最终pa4.validate()和源文件/共享引用/色码/皮肤身份审计。

## 第6批：完成

在既有 web-public-static 配置的 http://127.0.0.1:8626/art/starsea/pets/v3/preview/index.html 上运行原pa4.validate()：**2430/2430通过，镜像误差0，空帧0，控制台错误0**。实际合成采样14580次。

最终18家族、54成长runtime、162皮肤、486皮肤形态实例；共2713原生24fps采样帧。所有帧与原生导出逐像素复核：alpha不变，RGB差异只来自规定shift（最大2/255），码本还原误差0。9套皮肤的底图均由a=255原色码字输出，palette保留但不改色。

挂件逐原生帧检查共24417个皮肤/帧组合，最大可见alpha面积比 14.7001%，超限0；三形态因同源同比例缩放，面积比不变。保留原挂件/特效PNG及ID、类型、层级、anchor和全部特效参数；定位offset及63套超限组的displaySize展示适配已经单独记录。

### 最终18家族

|岛屿|零氪|轻氪|重氪|
|---|---|---|---|
|风栖|xiaoyuniguai|bingren|jinlong|
|雾铃|xiaozhizhu|yuniguai|jiutoushe|
|赤炉|xiaoemo|emo|dalong|
|霜镜|bailong|ejiao|gulong_1|
|龙眠|xiaolong|lvlongwang|shenyuanjiutoulong|
|沉星|xiaoyuanling|diyusantouquan|heilong_1|

18个baseFamily去重通过；assets/actors占用家族及其_1版本全部避开。julongzisi只用于本地回归对照，不在最终资源或18家族生产数组内。

### 体积结论

整个 apps/web/public/art/starsea/pets/v3 实际 **79820505字节 = 79.821MB = 76.123MiB**。50MB目标**未达标**。已依次实行三形态共享、符合清晰度下限的9族192物理格、额外无损索引重排；继续降低其余族分辨率会低于referencePixelHeight≥1.3×最大显示高度条件。依第6节“仍超则记录实际体积，不算阻塞”保留此实测结果，没有伪称达标、删动作或进一步有损降精度。

### 最终裁决与实现说明

- SkeletonBinary.ts由typescript在内存中转译，保留许可注释；无编译产物写入工具目录。与样板再次回归仍为163帧、挂点误差0px。
- 原库个别touying区域名有尾随空格，加载器仅在查找失败时trim匹配；源skel/atlas/png未改动。
- composer.js逐字节不变，实际字节协议仍为RG16索引＋B8覆盖率、码字首字节255原色输出。样板描述字符串中误写的RGB24已纠正为实际协议名，不是运行格式升级。
- 192物理格在256逻辑格内虚拟补32px，spriteSourceSize/anchor/sockets同步平移；不存储透明补边，因此无需改合成器。
- 目视检查后将雾铃小蛛徽记上移到身体侧面，避免原偏移落到足下；尾饰按收缩后的尺寸对准尾根。
- 预览网格按全部动作和挂件实际范围扩大为340×300，三列按同流派的零/轻/重排列；统一位置不裁切动作或遮住标签。形态下拉去掉旧44/56/68数字，每格显示真实高度。
- 原生地影/嵌入效果已隐藏。验收同排图上的部分蓝色光盘来自按要求保留的skins.effects；18张裸模型动作图不叠这些皮肤效果。
- 8626原只读静态进程曾退出，按既有web-public-static命令恢复同一静态根目录；未访问或修改8612/8790正式写接口。

### 本地验收文件

根目录：G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/.design/pet-sp33-rollout/

- candidates-wind/mist/forge/frost/dragon/star.png：每岛每档2候选，1×与2×，含主角/巡猎兽。
- acceptance-wind/mist/forge/frost/dragon/star.png：每岛三档×三形态，主角/巡猎兽，1×与2×。
- skins81-wind/mist/forge/frost/dragon/star.png：每岛27皮肤×3形态，共486实例。
- all-162.png：全部162皮肤幼年1×总览。
- actions-<island>-<tier>.png：18族各五动作×六帧及五挂点。
- preview-8626.png、preview-mirrored-8626.png：最终可视Chrome预览。
- pa4-validation.json、final-audit.json、attachment-audit.json、size.json：原始检查明细，仅本地。

### 第8节完成定义

- [x] 工具配置化；岚鳞样板回归帧数一致、挂点0px误差、全量验证通过。
- [x] 18家族选定、去重、避开占用和禁用生物，理由与表格已登记。
- [x] 54形态全部SP33原生帧，三档尺寸为44/56/68、48/62/74、54/70/84。
- [x] 三形态共用一套资源；体积超目标，已按明确默认裁决记录。
- [x] 162个skins.family更新；挂件位置、面积及镜像检查通过。
- [x] pa4.validate() 2430/2430，镜像误差0、无空帧、无控制台错误。
- [x] 六岛同排、162总览、486实例对比、18族动作抽查图齐全。
- [x] 进度文件包含批次开始/完成、选型、隐藏规则、裁决与最终数字。

状态：六批全部完成（含第6节体积超限记录例外），非硬阻塞。模型资源已替换；最终动作映射抽查与游戏接入仍由Claude负责。未做玩法、强度、价格、数据库或合同版本修改，未git commit。

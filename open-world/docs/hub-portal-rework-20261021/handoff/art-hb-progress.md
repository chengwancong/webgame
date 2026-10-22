# ART-HB 美术执行进度

执行日期：2026-10-22。顺序 R0 → S1 → S2 → H1 → R9；仅本地美术与资源清单，不接线。

- [x] R0 基准板与协作状态
- [x] S1 星门
- [x] S2 建设摆件 12 件
- [x] H1 01–10
- [x] H1 11–20
- [x] H1 21–30
- [x] H1 31–40
- [x] H1 41–50
- [x] H1 51–59
- [x] R9 收尾、校验、接线清单、限定路径提交

## 执行记录

开工实测协作文档 25,952 字符，未达到 40,000 字符归档门槛；通过指定脚本把 ART-HB 改为进行中。

R0：港口基准板 .runtime/art-hb/baseline.png，1280×600，sha256 247fab7d0e1a；建筑宽度 250/255/260/290，hero idle_0 身高参照，地表 256px 平铺与奶白 wash。图标基准板 .runtime/art-hb/hex-baseline.png，1230×420，使用实际四品质色，12+6 字形、48/24px。离线目视通过。


### R0 哈希补录与 S1 示意图

- `.runtime/art-hb/hex-baseline.png`｜1230×420｜sha256 `42360c9897f2`
- `.runtime/art-hb/stargate-sketch-1.png`｜512×512｜sha256 `f4f881fb6bc3`
- `.runtime/art-hb/stargate-sketch-2.png`｜512×512｜sha256 `98f9c0bb6b5a`
- `.runtime/art-hb/stargate-selection.png`｜1280×600｜sha256 `3f69cf803275`

自检：基准色与现有Token一致；选择2。
S1 目视复核通过：浅石门与建筑描边/光向相符，镂空独立、星图低于石环亮度、6帧呼吸与8帧爆发序列已逐帧对照。星图盘实际13点/6条线；中心偏移源像素[-5,-282]，显示像素[-2.5,-141]；单独旋转星图并先于base绘制。

### S2 build-forge-1

- `apps/web/public/art/hub-port/build-forge-1.png`｜128×148｜sha256 `3cc2bfbb683c`
- `.runtime/art-hb/build-forge-1-compare.png`｜1280×600｜sha256 `0e1c062c4cbe`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-forge-2

- `apps/web/public/art/hub-port/build-forge-2.png`｜144×124｜sha256 `0f3c1f625820`
- `.runtime/art-hb/build-forge-2-compare.png`｜1280×600｜sha256 `083cc74bd087`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-forge-3

- `apps/web/public/art/hub-port/build-forge-3.png`｜192×184｜sha256 `419cdf765d1b`
- `.runtime/art-hb/build-forge-3-compare.png`｜1280×600｜sha256 `93b4553a049c`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-forge-4

- `apps/web/public/art/hub-port/build-forge-4.png`｜144×232｜sha256 `7df535a11979`
- `.runtime/art-hb/build-forge-4-compare.png`｜1280×600｜sha256 `86326b1f8783`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-dock-1

- `apps/web/public/art/hub-port/build-dock-1.png`｜96×200｜sha256 `c43ce47d5029`
- `.runtime/art-hb/build-dock-1-compare.png`｜1280×600｜sha256 `740987a597c2`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-dock-2

- `apps/web/public/art/hub-port/build-dock-2.png`｜192×132｜sha256 `7bbeaa6ea77e`
- `.runtime/art-hb/build-dock-2-compare.png`｜1280×600｜sha256 `1d3a05f0c90c`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-dock-3

- `apps/web/public/art/hub-port/build-dock-3.png`｜144×148｜sha256 `a6d0222f646a`
- `.runtime/art-hb/build-dock-3-compare.png`｜1280×600｜sha256 `bd30ec5b941d`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-dock-4

- `apps/web/public/art/hub-port/build-dock-4.png`｜192×156｜sha256 `ad4ab2d6d5fd`
- `.runtime/art-hb/build-dock-4-compare.png`｜1280×600｜sha256 `fe34a508208a`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-post-1

- `apps/web/public/art/hub-port/build-post-1.png`｜96×148｜sha256 `62b08e9ad293`
- `.runtime/art-hb/build-post-1-compare.png`｜1280×600｜sha256 `2fa3eff17536`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-post-2

- `apps/web/public/art/hub-port/build-post-2.png`｜160×164｜sha256 `9724e69abf40`
- `.runtime/art-hb/build-post-2-compare.png`｜1280×600｜sha256 `1ebf70c677dd`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-post-3

- `apps/web/public/art/hub-port/build-post-3.png`｜128×208｜sha256 `0162fff8006e`
- `.runtime/art-hb/build-post-3-compare.png`｜1280×600｜sha256 `e358241be152`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 build-post-4

- `apps/web/public/art/hub-port/build-post-4.png`｜176×180｜sha256 `1112eff31452`
- `.runtime/art-hb/build-post-4-compare.png`｜1280×600｜sha256 `4224f00b3788`

自检：参考图匹配的厚涂/俯视素材已缩放，脚下4px透明，饱和度0.88，锚点[0.5,1]；并排目视通过，详细轮廓结论见S2汇总。

### S2 合图与技术检查

- `apps/web/public/art/hub-port/build-props.png`｜1818×236｜sha256 `b1f6966a3112`
- `apps/web/public/art/hub-port/build-props.json`｜JSON｜sha256 `89aaff51bec3`
- `.runtime/art-hb/build-props-sheet.png`｜1060×620｜sha256 `e6e1e5e37301`
- `.runtime/art-hb/build-props-silhouette.png`｜1140×120｜sha256 `85fb97b14469`
- `.runtime/art-hb/full-port.png`｜1280×600｜sha256 `5d73c3be5d42`
- `.runtime/art-hb/all-prop-comparisons.png`｜1280×1800｜sha256 `147306144bba`

自检：12单图/12帧齐全，透明底4px安全边、2px图集间距、不裁切不旋转；逐件并排与54px剪影已核验，结论见下。

S2逐件目视自检（全部已与基准板并排；54px黑剪影与原尺寸检查）：
- [x] forge-1 工具架三件工具轮廓独立；通过。
- [x] forge-2 台阶式箱堆与袋口可读，黑剪影只能辨货堆不能辨矿石材质；通过。
- [x] forge-3 布篷与开放台面可读；通过。
- [x] forge-4 齿轮孔和钟形可读；通过。
- [x] dock-1 悬挂灯笼与柱体分离；通过。
- [x] dock-2 低矮船体可读；通过。
- [x] dock-3 桌腿与六分仪外突轮廓可读；通过。
- [x] dock-4 三角旗与青绿涂装区分二队；通过。
- [x] post-1 圆顶邮筒可读；通过。
- [x] post-2 屋檐告示板可读；通过。
- [x] post-3 两杆双旗轮廓分离；通过。
- [x] post-4 车轮与高位笼形可读；通过。
四阶按累加摆放理解，第四阶以高位招牌/旗帆/鸽笼车形成高潮；满级同屏不压过建筑。

### H1 图标清单与预览

- `packages/asset-manifest/hex-glyphs.v1.json`｜JSON｜sha256 `45dbebe003c5`
- `.runtime/art-hb/hex-sheet.png`｜1570×1590｜sha256 `098d1706541a`
- `.runtime/art-hb/hex-black-white.png`｜1520×470｜sha256 `5d2389c3a11d`

自检：59条齐全，11复用48新画，单强调填充/标签/字符上限通过；安全区与24px黑白形状已复核，通过。

### H1 01–10 自检通过

- [x] aftershock｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/aftershock｜viewBox 50×50；预览48/24px｜2954842b1606｜复用 quake；类别内轮廓可区分。
- [x] star-shards｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/star-shards｜viewBox 50×50；预览48/24px｜de2cd38d5fff｜新字形 161字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] cast-echo｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/cast-echo｜viewBox 50×50；预览48/24px｜bf4cd532debd｜新字形 119字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] storm-reaper｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/storm-reaper｜viewBox 50×50；预览48/24px｜e715b790cd79｜复用 reaper；类别内轮廓可区分。
- [x] void-rift｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/void-rift｜viewBox 50×50；预览48/24px｜be99148c91ee｜复用 rift；类别内轮廓可区分。
- [x] thorned-heart｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/thorned-heart｜viewBox 50×50；预览48/24px｜3d710cde105e｜复用 thorns；类别内轮廓可区分。
- [x] overflow-spring｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/overflow-spring｜viewBox 50×50；预览48/24px｜710afd3c06cc｜复用 spring；类别内轮廓可区分。
- [x] last-stand｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/last-stand｜viewBox 50×50；预览48/24px｜dc4d703e4c1e｜新字形 143字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] riposte｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/riposte｜viewBox 50×50；预览48/24px｜ad75f3979b6c｜新字形 134字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] shadow-veil｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/shadow-veil｜viewBox 50×50；预览48/24px｜4f6664873f82｜新字形 143字符；安全区和单强调填充通过；类别内轮廓可区分。

### H1 11–20 自检通过

- [x] cornered-will｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/cornered-will｜viewBox 50×50；预览48/24px｜62c1591acb1e｜新字形 131字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] detonation-sigil｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/detonation-sigil｜viewBox 50×50；预览48/24px｜6ae68e3c53e1｜复用 sigil；类别内轮廓可区分。
- [x] bee-volley｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/bee-volley｜viewBox 50×50；预览48/24px｜4d34410be369｜新字形 191字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] cast-hit-relay｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/cast-hit-relay｜viewBox 50×50；预览48/24px｜d58acc37ddaf｜新字形 155字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] control-to-shield｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/control-to-shield｜viewBox 50×50；预览48/24px｜9b1a9ce56f13｜新字形 158字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] footfall-heal｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/footfall-heal｜viewBox 50×50；预览48/24px｜79b30da67242｜新字形 178字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] cycle-reset｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/cycle-reset｜viewBox 50×50；预览48/24px｜f10cc133fc35｜新字形 179字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] awakening-quest｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/awakening-quest｜viewBox 50×50；预览48/24px｜cc827013632a｜新字形 149字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] mark-relay｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/mark-relay｜viewBox 50×50；预览48/24px｜963adee4106a｜新字形 134字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] undying-grip｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/undying-grip｜viewBox 50×50；预览48/24px｜798fb2844b72｜新字形 188字符；安全区和单强调填充通过；类别内轮廓可区分。

### H1 21–30 自检通过

- [x] dark-harvest｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/dark-harvest｜viewBox 50×50；预览48/24px｜7bf3ecea603b｜新字形 152字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] first-blood｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/first-blood｜viewBox 50×50；预览48/24px｜40ad1cd8fac5｜新字形 147字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] fearless-soul｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/fearless-soul｜viewBox 50×50；预览48/24px｜91b505c23663｜新字形 176字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] fury-undying｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/fury-undying｜viewBox 50×50；预览48/24px｜b665573225a0｜新字形 167字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] endless-devour｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/endless-devour｜viewBox 50×50；预览48/24px｜90af9e79b53f｜新字形 174字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] spellflow｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/spellflow｜viewBox 50×50；预览48/24px｜4deadceae813｜新字形 155字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] missile-escalation｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/missile-escalation｜viewBox 50×50；预览48/24px｜ce59b9239759｜新字形 160字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] prism-bolt｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/prism-bolt｜viewBox 50×50；预览48/24px｜439fe6abc4ec｜新字形 149字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] quantum-slash｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/quantum-slash｜viewBox 50×50；预览48/24px｜23c081240cfc｜新字形 149字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] pinball-mark｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/pinball-mark｜viewBox 50×50；预览48/24px｜93f1761798ca｜新字形 211字符；安全区和单强调填充通过；类别内轮廓可区分。

### H1 31–40 自检通过

- [x] frost-armor｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/frost-armor｜viewBox 50×50；预览48/24px｜fae216de1ac3｜复用 frost；类别内轮廓可区分。
- [x] freeze-pulse｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/freeze-pulse｜viewBox 50×50；预览48/24px｜6226c06ecd86｜新字形 134字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] gravity-well｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/gravity-well｜viewBox 50×50；预览48/24px｜1810484a4c4f｜新字形 173字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] silence-touch｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/silence-touch｜viewBox 50×50；预览48/24px｜e8b8a24aeaf0｜新字形 158字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] petrify-gaze｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/petrify-gaze｜viewBox 50×50；预览48/24px｜ec0147d053c0｜新字形 153字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] terror-wave｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/terror-wave｜viewBox 50×50；预览48/24px｜ff624bd88618｜新字形 170字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] phantom-step｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/phantom-step｜viewBox 50×50；预览48/24px｜a9f16bbb9c44｜复用 phantom；类别内轮廓可区分。
- [x] dash-embers｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/dash-embers｜viewBox 50×50；预览48/24px｜094595c5c855｜新字形 161字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] kinetic-charge｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/kinetic-charge｜viewBox 50×50；预览48/24px｜d0f11b2a733c｜新字形 140字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] landing-quake｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/landing-quake｜viewBox 50×50；预览48/24px｜8cf1b32e1cc9｜新字形 161字符；安全区和单强调填充通过；类别内轮廓可区分。

### H1 41–50 自检通过

- [x] blink-strike｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/blink-strike｜viewBox 50×50；预览48/24px｜919685f502cc｜新字形 167字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] phase-swap｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/phase-swap｜viewBox 50×50；预览48/24px｜ca273b9b6e93｜新字形 144字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] mana-siphon｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/mana-siphon｜viewBox 50×50；预览48/24px｜17bfb0a24c30｜复用 siphon；类别内轮廓可区分。
- [x] resonance-echo｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/resonance-echo｜viewBox 50×50；预览48/24px｜f795198e2270｜复用 echo；类别内轮廓可区分。
- [x] mana-surge｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/mana-surge｜viewBox 50×50；预览48/24px｜c9b17b2c3a8d｜新字形 153字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] blood-contract｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/blood-contract｜viewBox 50×50；预览48/24px｜238cdb518afb｜新字形 155字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] free-incantation｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/free-incantation｜viewBox 50×50；预览48/24px｜8a02ed7717c6｜新字形 177字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] finisher-refund｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/finisher-refund｜viewBox 50×50；预览48/24px｜6301b3bf1d2d｜新字形 158字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] hunter-mark｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/hunter-mark｜viewBox 50×50；预览48/24px｜2115d3735b5d｜复用 mark；类别内轮廓可区分。
- [x] weak-point｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/weak-point｜viewBox 50×50；预览48/24px｜9b886af72c96｜新字形 134字符；安全区和单强调填充通过；类别内轮廓可区分。

### H1 51–59 自检通过

- [x] plague-spread｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/plague-spread｜viewBox 50×50；预览48/24px｜efe1c9936bce｜新字形 263字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] lingering-flame｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/lingering-flame｜viewBox 50×50；预览48/24px｜be5243a60010｜新字形 170字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] shatter-ice｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/shatter-ice｜viewBox 50×50；预览48/24px｜e2656d8c9bc4｜新字形 173字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] executioner｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/executioner｜viewBox 50×50；预览48/24px｜97b6a080b3f7｜新字形 143字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] pair-resonance｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/pair-resonance｜viewBox 50×50；预览48/24px｜b2b2578a1c71｜新字形 159字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] knockback-wave｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/knockback-wave｜viewBox 50×50；预览48/24px｜542ae64d1fdf｜新字形 149字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] void-servant｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/void-servant｜viewBox 50×50；预览48/24px｜f3a537cf4e1f｜新字形 183字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] stack-burst｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/stack-burst｜viewBox 50×50；预览48/24px｜b7aedd00dfc6｜新字形 170字符；安全区和单强调填充通过；类别内轮廓可区分。
- [x] decoy｜packages/asset-manifest/hex-glyphs.v1.json#/glyphs/decoy｜viewBox 50×50；预览48/24px｜a6696f2538ac｜新字形 189字符；安全区和单强调填充通过；类别内轮廓可区分。

建议重画：无明显机制冲突，11个复用项按指定映射；沿用旧字形的历史笔画越界/填充写法不在本次修改范围。

### S1 星门输出

- `.runtime/art-hb/frames/stargate-base.png`｜440×520｜sha256 `8e76951c2642`
- `.runtime/art-hb/frames/stargate-glow-0.png`｜440×520｜sha256 `473ad661f6e9`
- `.runtime/art-hb/frames/stargate-glow-1.png`｜440×520｜sha256 `636e7b51ea5b`
- `.runtime/art-hb/frames/stargate-glow-2.png`｜440×520｜sha256 `3fae76b254ab`
- `.runtime/art-hb/frames/stargate-glow-3.png`｜440×520｜sha256 `9a0a8a28d731`
- `.runtime/art-hb/frames/stargate-glow-4.png`｜440×520｜sha256 `3fae76b254ab`
- `.runtime/art-hb/frames/stargate-glow-5.png`｜440×520｜sha256 `636e7b51ea5b`
- `.runtime/art-hb/frames/stargate-ring-lit.png`｜440×520｜sha256 `8614d7f0ca0c`
- `.runtime/art-hb/frames/stargate-chart.png`｜300×300｜sha256 `1e8bdd8dd221`
- `.runtime/art-hb/frames/stargate-open-0.png`｜440×520｜sha256 `da606dc3b379`
- `.runtime/art-hb/frames/stargate-open-1.png`｜440×520｜sha256 `14992308686b`
- `.runtime/art-hb/frames/stargate-open-2.png`｜440×520｜sha256 `768cf070fec1`
- `.runtime/art-hb/frames/stargate-open-3.png`｜440×520｜sha256 `2db0ba2180e3`
- `.runtime/art-hb/frames/stargate-open-4.png`｜440×520｜sha256 `3175533874dd`
- `.runtime/art-hb/frames/stargate-open-5.png`｜440×520｜sha256 `749a4631ca2d`
- `.runtime/art-hb/frames/stargate-open-6.png`｜440×520｜sha256 `362a443b6bb8`
- `.runtime/art-hb/frames/stargate-open-7.png`｜440×520｜sha256 `297923455837`
- `apps/web/public/art/hub-port/stargate.png`｜1770×1348｜sha256 `0311d4435962`
- `apps/web/public/art/hub-port/stargate.json`｜JSON｜sha256 `742e47648955`
- `apps/web/public/art/hub-port/stargate-fx.png`｜1770×1046｜sha256 `d355a1040dbb`
- `apps/web/public/art/hub-port/stargate-fx.json`｜JSON｜sha256 `93b61a6dfe1b`
- `.runtime/art-hb/stargate-compare.png`｜1280×600｜sha256 `250dbce0a638`
- `.runtime/art-hb/stargate-contact.png`｜980×580｜sha256 `6c33ac1ba90a`

自检：分层/尺寸/帧名机器检查完成；目视复核通过，石环/星盘/光层独立且对齐。星图中心源画布 (215,238)，显示偏移 (-2.5,-141)，建议占地6×2格。

### R9 总览与最终机器验收

- `.runtime/art-hb/overview.png`｜1900×900｜sha256 `d635f06e0829`
- `packages/asset-manifest/starsea.v1.json`｜JSON｜sha256 `befe26291e3b`
- `packages/asset-manifest/hex-glyphs.v1.json`｜JSON｜sha256 `45dbebe003c5`

自检：13条本批资源/29帧（17星门+12摆件）、ICC/透明RGB归零/尺寸/2px间距/底4px安全边/源哈希/无重名均通过；运行时PNG+JSON合计 3270932 bytes（3.119 MiB），≤8MiB；既有129条资源内容未改变。

## R9 校验结果

- [x] `npx tsc --noEmit -p .`：退出0。
- [x] `pnpm config:check`：退出0，10本工作簿一致。
- [x] `npx tsx tools/validate-content.ts`：退出0，ok=true。
- [x] `rg -l asset-manifest tests -g *.test.ts` 得到16个测试文件，`npx vitest run <这些文件> --maxWorkers=1 --no-file-parallelism`：83/83通过，16/16文件通过；包括plane-scenes，本轮无既有失败。
- [x] 本地导出验收：29帧=17星门+12摆件，13条登记，59词缀=11复用+48新画，帧名/源尺寸/2px间距/4px底部安全边/ICC/透明RGB归零/来源哈希均通过。
- [x] 本批运行时文件 3270932 bytes（3.119 MiB），小于8MiB。
- [x] 总览已目视核对，离线合成图在 `.runtime/art-hb/overview.png`；未使用浏览器自动化，未下载素材。
- [x] 本批未编辑 apps/web/src、地图JSON、正式测试、玩法或数值。
- [x] `source/prompts.json` 保存全部17次内置imagegen提示；原图、分层及对比仅在 `.runtime/art-hb/`，运行时图片仅在忽略目录。

本地复核：`node .runtime/art-hb/finalize-art.mjs`（导出验证）和 `.runtime/art-hb/glyph-validation.json`（48字形安全区/长度）；测试原始日志位于 `.runtime/art-hb/{tsc,config-check,content-check,manifest-tests}.log`。

## 完成定义 §6

- [x] S1五类17帧、S2十二摆件到位，13条producer-reviewed登记；两页星门图集为D-H8容量裁决。
- [x] H1共59条，11复用48新画，四品质48/24px总表及24px黑白检查完成。
- [x] 每项基准对比、自检与总览完成。
- [x] 接线清单齐全。
- [x] 限定路径提交仅两份清单JSON、进度和决策；无图片或原始素材；协作中心已通过指定脚本改为待接线并写指定留言。

提交范围核对：仅4个限定路径；starsea.v1.json提交版本只含本批13条新增（连同HEAD已有条目），sha256前12位 `06a4073761b3`；共享工作区中的并行新增条目未夹带。共享清单上文哈希为生成当时工作区快照。

## 接线清单

所有路径相对 `open-world/`；以下资源均待Claude接线。星门须加载两页TexturePacker hash，JSON的related_multi_packs互指。该两页处理保留所有原帧尺寸，避免超过2048限制。

| 资源id / 路径 | 帧名 | 锚点 | 建议显示尺寸 | 占地/偏移 | 接到哪里 |
|---|---|---|---|---|---|
| ss-scene-stargate / /art/hub-port/stargate.{png,json} | stargate-base | [0.5,1] | 220×260px（源440×520） | 石阶可见约200×50px；碰撞建议6×2格，底部中心落点 | ss-map-port / stargate (14,18)，M01广场 |
| ss-scene-stargate / /art/hub-port/stargate.{png,json} | stargate-chart | [0.5,0.5] | 150×138px（源300×300正圆） | 相对base底锚点[-2.5,-141]px；源中心[215,238] | 在base下层旋转，先旋转正圆再压扁；M02星图盘 |
| ss-scene-stargate / /art/hub-port/stargate.{png,json} | stargate-glow-0…5 | [0.5,1] | 220×260px | 与base同位置、同缩放；6fps循环 | M01星门六颗星石待机呼吸，上层alpha混合 |
| ss-scene-stargate / /art/hub-port/stargate.{png,json} | stargate-ring-lit | [0.5,1] | 220×260px | 与base同位置、同缩放 | M09收齐12生命星晶后叠加，alpha混合 |
| ss-scene-stargate / /art/hub-port/stargate-fx.{png,json} | stargate-open-0…7 | [0.5,1] | 220×260px | 与base同位置、同缩放；8fps不循环，共1秒 | M02出发转场：亮起→光柱→收束；叠在base上 |
| ss-scene-build-forge-1 / /art/hub-port/build-forge-1.png | build-forge-1（也在build-props图集） | [0.5,1] | 64×74px（源×2） | 工坊(19,17)左侧；底部4源像素透明；无强制碰撞 | M09 forge 建设等级≥1累加显示，resourceId消费单图 |
| ss-scene-build-forge-2 / /art/hub-port/build-forge-2.png | build-forge-2（也在build-props图集） | [0.5,1] | 72×62px（源×2） | 工坊右侧；底部4源像素透明；无强制碰撞 | M09 forge 建设等级≥2累加显示，resourceId消费单图 |
| ss-scene-build-forge-3 / /art/hub-port/build-forge-3.png | build-forge-3（也在build-props图集） | [0.5,1] | 96×92px（源×2） | 工坊前路边；底部4源像素透明；无强制碰撞 | M09 forge 建设等级≥3累加显示，resourceId消费单图 |
| ss-scene-build-forge-4 / /art/hub-port/build-forge-4.png | build-forge-4（也在build-props图集） | [0.5,1] | 72×116px（源×2） | 工坊屋前高处；底部4源像素透明；无强制碰撞 | M09 forge 建设等级≥4累加显示，resourceId消费单图 |
| ss-scene-build-dock-1 / /art/hub-port/build-dock-1.png | build-dock-1（也在build-props图集） | [0.5,1] | 48×100px（源×2） | 码头(25,8)栈桥口；底部4源像素透明；无强制碰撞 | M09 dock 建设等级≥1累加显示，resourceId消费单图 |
| ss-scene-build-dock-2 / /art/hub-port/build-dock-2.png | build-dock-2（也在build-props图集） | [0.5,1] | 96×66px（源×2） | 码头水边；底部4源像素透明；无强制碰撞 | M09 dock 建设等级≥2累加显示，resourceId消费单图 |
| ss-scene-build-dock-3 / /art/hub-port/build-dock-3.png | build-dock-3（也在build-props图集） | [0.5,1] | 72×74px（源×2） | 码头岸上；底部4源像素透明；无强制碰撞 | M09 dock 建设等级≥3累加显示，resourceId消费单图 |
| ss-scene-build-dock-4 / /art/hub-port/build-dock-4.png | build-dock-4（也在build-props图集） | [0.5,1] | 96×78px（源×2） | 码头另一侧水边；底部4源像素透明；无强制碰撞 | M09 dock 建设等级≥4累加显示，resourceId消费单图 |
| ss-scene-build-post-1 / /art/hub-port/build-post-1.png | build-post-1（也在build-props图集） | [0.5,1] | 48×74px（源×2） | 登陆点(5,25)旁；底部4源像素透明；无强制碰撞 | M09 post 建设等级≥1累加显示，resourceId消费单图 |
| ss-scene-build-post-2 / /art/hub-port/build-post-2.png | build-post-2（也在build-props图集） | [0.5,1] | 80×82px（源×2） | 邮局前；底部4源像素透明；无强制碰撞 | M09 post 建设等级≥2累加显示，resourceId消费单图 |
| ss-scene-build-post-3 / /art/hub-port/build-post-3.png | build-post-3（也在build-props图集） | [0.5,1] | 64×104px（源×2） | 邮局屋顶旁；底部4源像素透明；无强制碰撞 | M09 post 建设等级≥3累加显示，resourceId消费单图 |
| ss-scene-build-post-4 / /art/hub-port/build-post-4.png | build-post-4（也在build-props图集） | [0.5,1] | 88×90px（源×2） | 邮局侧面；底部4源像素透明；无强制碰撞 | M09 post 建设等级≥4累加显示，resourceId消费单图 |

摆件图集：`apps/web/public/art/hub-port/build-props.{png,json}`；可直接使用以上12张单图，无须改现有resourceId消费者。第4阶宽度均≤所属基准建筑40%。摆件为视觉附属，地图是否阻挡由Claude按场景决定。

| 图标id / 清单路径 | 字形名/内容 | 锚点 | 显示 | 偏移 | 接到哪里 |
|---|---|---|---|---|---|
| hex-aftershock / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/aftershock | reuse → quake | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-aftershock] → quake |
| hex-star-shards / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/star-shards | markup → star-shards；暴击中心向三方迸出碎星 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-star-shards] → star-shards；glyphPaths[star-shards] = markup；扩充HexGlyph类型 |
| hex-cast-echo / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/cast-echo | markup → cast-echo；双重施法波从同一点发出 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-cast-echo] → cast-echo；glyphPaths[cast-echo] = markup；扩充HexGlyph类型 |
| hex-storm-reaper / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/storm-reaper | reuse → reaper | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-storm-reaper] → reaper |
| hex-void-rift / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/void-rift | reuse → rift | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-void-rift] → rift |
| hex-thorned-heart / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/thorned-heart | reuse → thorns | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-thorned-heart] → thorns |
| hex-overflow-spring / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/overflow-spring | reuse → spring | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-overflow-spring] → spring |
| hex-last-stand / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/last-stand | markup → last-stand；致命斩击被最后一柱截住 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-last-stand] → last-stand；glyphPaths[last-stand] = markup；扩充HexGlyph类型 |
| hex-riposte / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/riposte | markup → riposte；斜盾拦截后反向出刃 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-riposte] → riposte；glyphPaths[riposte] = markup；扩充HexGlyph类型 |
| hex-shadow-veil / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/shadow-veil | markup → shadow-veil；残影躲入弯月护幕 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-shadow-veil] → shadow-veil；glyphPaths[shadow-veil] = markup；扩充HexGlyph类型 |
| hex-cornered-will / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/cornered-will | markup → cornered-will；低血线前筑起不倒的堡垒 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-cornered-will] → cornered-will；glyphPaths[cornered-will] = markup；扩充HexGlyph类型 |
| hex-detonation-sigil / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/detonation-sigil | reuse → sigil | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-detonation-sigil] → sigil |
| hex-bee-volley / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/bee-volley | markup → bee-volley；蜂体领出三路蜂群 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-bee-volley] → bee-volley；glyphPaths[bee-volley] = markup；扩充HexGlyph类型 |
| hex-cast-hit-relay / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/cast-hit-relay | markup → cast-hit-relay；法球与斩击交替接力 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-cast-hit-relay] → cast-hit-relay；glyphPaths[cast-hit-relay] = markup；扩充HexGlyph类型 |
| hex-control-to-shield / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/control-to-shield | markup → control-to-shield；钳住目标后凝成盾片 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-control-to-shield] → control-to-shield；glyphPaths[control-to-shield] = markup；扩充HexGlyph类型 |
| hex-footfall-heal / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/footfall-heal | markup → footfall-heal；脚印走过长出嫩叶 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-footfall-heal] → footfall-heal；glyphPaths[footfall-heal] = markup；扩充HexGlyph类型 |
| hex-cycle-reset / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/cycle-reset | markup → cycle-reset；沙漏完成一轮归零 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-cycle-reset] → cycle-reset；glyphPaths[cycle-reset] = markup；扩充HexGlyph类型 |
| hex-awakening-quest / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/awakening-quest | markup → awakening-quest；试炼阶梯上方睁开觉醒之眼 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-awakening-quest] → awakening-quest；glyphPaths[awakening-quest] = markup；扩充HexGlyph类型 |
| hex-mark-relay / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/mark-relay | markup → mark-relay；方印从技能轨迹传向下一目标 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-mark-relay] → mark-relay；glyphPaths[mark-relay] = markup；扩充HexGlyph类型 |
| hex-undying-grip / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/undying-grip | markup → undying-grip；五指握住可吸取的生命核 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-undying-grip] → undying-grip；glyphPaths[undying-grip] = markup；扩充HexGlyph类型 |
| hex-dark-harvest / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/dark-harvest | markup → dark-harvest；弯镰收拢残血灵魂 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-dark-harvest] → dark-harvest；glyphPaths[dark-harvest] = markup；扩充HexGlyph类型 |
| hex-first-blood / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/first-blood | markup → first-blood；满血横条上的第一滴斩血 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-first-blood] → first-blood；glyphPaths[first-blood] = markup；扩充HexGlyph类型 |
| hex-fearless-soul / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/fearless-soul | markup → fearless-soul；定时释放的炽热拳核 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-fearless-soul] → fearless-soul；glyphPaths[fearless-soul] = markup；扩充HexGlyph类型 |
| hex-fury-undying / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/fury-undying | markup → fury-undying；怒焰包裹不断裂的生命线 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-fury-undying] → fury-undying；glyphPaths[fury-undying] = markup；扩充HexGlyph类型 |
| hex-endless-devour / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/endless-devour | markup → endless-devour；张开的吞噬之口吸入一枚核心 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-endless-devour] → endless-devour；glyphPaths[endless-devour] = markup；扩充HexGlyph类型 |
| hex-spellflow / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/spellflow | markup → spellflow；连续法流叠向加速羽翼 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-spellflow] → spellflow；glyphPaths[spellflow] = markup；扩充HexGlyph类型 |
| hex-missile-escalation / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/missile-escalation | markup → missile-escalation；一枚两枚三枚依次增加的齐射 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-missile-escalation] → missile-escalation；glyphPaths[missile-escalation] = markup；扩充HexGlyph类型 |
| hex-prism-bolt / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/prism-bolt | markup → prism-bolt；棱镜魔弹穿过标记后爆开 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-prism-bolt] → prism-bolt；glyphPaths[prism-bolt] = markup；扩充HexGlyph类型 |
| hex-quantum-slash / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/quantum-slash | markup → quantum-slash；圆斩的外圈刃弧 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-quantum-slash] → quantum-slash；glyphPaths[quantum-slash] = markup；扩充HexGlyph类型 |
| hex-pinball-mark / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/pinball-mark | markup → pinball-mark；弹球在折返轨迹中逐次增幅 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-pinball-mark] → pinball-mark；glyphPaths[pinball-mark] = markup；扩充HexGlyph类型 |
| hex-frost-armor / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/frost-armor | reuse → frost | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-frost-armor] → frost |
| hex-freeze-pulse / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/freeze-pulse | markup → freeze-pulse；冰晶中心向两侧炸开寒潮 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-freeze-pulse] → freeze-pulse；glyphPaths[freeze-pulse] = markup；扩充HexGlyph类型 |
| hex-gravity-well / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/gravity-well | markup → gravity-well；旋涡吸入中心 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-gravity-well] → gravity-well；glyphPaths[gravity-well] = markup；扩充HexGlyph类型 |
| hex-silence-touch / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/silence-touch | markup → silence-touch；手指封住施法波 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-silence-touch] → silence-touch；glyphPaths[silence-touch] = markup；扩充HexGlyph类型 |
| hex-petrify-gaze / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/petrify-gaze | markup → petrify-gaze；凝视之眼下垂出石裂 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-petrify-gaze] → petrify-gaze；glyphPaths[petrify-gaze] = markup；扩充HexGlyph类型 |
| hex-terror-wave / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/terror-wave | markup → terror-wave；惊惧面孔向外扩散 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-terror-wave] → terror-wave；glyphPaths[terror-wave] = markup；扩充HexGlyph类型 |
| hex-phantom-step / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/phantom-step | reuse → phantom | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-phantom-step] → phantom |
| hex-dash-embers / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/dash-embers | markup → dash-embers；冲刺靴后留下余火 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-dash-embers] → dash-embers；glyphPaths[dash-embers] = markup；扩充HexGlyph类型 |
| hex-kinetic-charge / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/kinetic-charge | markup → kinetic-charge；奔跑积蓄成上升的动能锤 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-kinetic-charge] → kinetic-charge；glyphPaths[kinetic-charge] = markup；扩充HexGlyph类型 |
| hex-landing-quake / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/landing-quake | markup → landing-quake；下落靴踏出放射地裂 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-landing-quake] → landing-quake；glyphPaths[landing-quake] = markup；扩充HexGlyph类型 |
| hex-blink-strike / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/blink-strike | markup → blink-strike；断开的箭轨落在暴击星点 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-blink-strike] → blink-strike；glyphPaths[blink-strike] = markup；扩充HexGlyph类型 |
| hex-phase-swap / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/phase-swap | markup → phase-swap；双影以反向箭轨交换位置 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-phase-swap] → phase-swap；glyphPaths[phase-swap] = markup；扩充HexGlyph类型 |
| hex-mana-siphon / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/mana-siphon | reuse → siphon | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-mana-siphon] → siphon |
| hex-resonance-echo / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/resonance-echo | reuse → echo | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-resonance-echo] → echo |
| hex-mana-surge / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/mana-surge | markup → mana-surge；空瓶底部重新涌起灵力回路 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-mana-surge] → mana-surge；glyphPaths[mana-surge] = markup；扩充HexGlyph类型 |
| hex-blood-contract / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/blood-contract | markup → blood-contract；血滴沿弧线归还生命 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-blood-contract] → blood-contract；glyphPaths[blood-contract] = markup；扩充HexGlyph类型 |
| hex-free-incantation / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/free-incantation | markup → free-incantation；免耗印章盖在打开的咏唱书 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-free-incantation] → free-incantation；glyphPaths[free-incantation] = markup；扩充HexGlyph类型 |
| hex-finisher-refund / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/finisher-refund | markup → finisher-refund；终结落刃把时针拨回 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-finisher-refund] → finisher-refund；glyphPaths[finisher-refund] = markup；扩充HexGlyph类型 |
| hex-hunter-mark / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/hunter-mark | reuse → mark | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-hunter-mark] → mark |
| hex-weak-point / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/weak-point | markup → weak-point；尖锥贯入破甲缺口 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-weak-point] → weak-point；glyphPaths[weak-point] = markup；扩充HexGlyph类型 |
| hex-plague-spread / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/plague-spread | markup → plague-spread；病灶沿分枝传向邻近目标 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-plague-spread] → plague-spread；glyphPaths[plague-spread] = markup；扩充HexGlyph类型 |
| hex-lingering-flame / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/lingering-flame | markup → lingering-flame；横向延烧的毒焰留下滴落尾迹 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-lingering-flame] → lingering-flame；glyphPaths[lingering-flame] = markup；扩充HexGlyph类型 |
| hex-shatter-ice / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/shatter-ice | markup → shatter-ice；裂开的冰块向四边崩散 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-shatter-ice] → shatter-ice；glyphPaths[shatter-ice] = markup；扩充HexGlyph类型 |
| hex-executioner / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/executioner | markup → executioner；斩首斧落向低血线 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-executioner] → executioner；glyphPaths[executioner] = markup；扩充HexGlyph类型 |
| hex-pair-resonance / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/pair-resonance | markup → pair-resonance；同源双符片之间共振 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-pair-resonance] → pair-resonance；glyphPaths[pair-resonance] = markup；扩充HexGlyph类型 |
| hex-knockback-wave / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/knockback-wave | markup → knockback-wave；格挡板把冲击波向外推出 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-knockback-wave] → knockback-wave；glyphPaths[knockback-wave] = markup；扩充HexGlyph类型 |
| hex-void-servant / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/void-servant | markup → void-servant；虚空裂口中站起持刃侍从 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-void-servant] → void-servant；glyphPaths[void-servant] = markup；扩充HexGlyph类型 |
| hex-stack-burst / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/stack-burst | markup → stack-burst；叠满的三层核心向上爆发 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-stack-burst] → stack-burst；glyphPaths[stack-burst] = markup；扩充HexGlyph类型 |
| hex-decoy / packages/asset-manifest/hex-glyphs.v1.json#/glyphs/decoy | markup → decoy；木架替身将攻击引向外侧 | SVG内板中心[25,25] | viewBox 50×50，24/48px，四品质共用 | 新字形安全区11–39，无额外偏移 | hex-rune-icon.ts：iconGlyphs[hex-decoy] → decoy；glyphPaths[decoy] = markup；扩充HexGlyph类型 |

接线统一约定：字形继承现有stroke-width=2与round cap/join；只换quality-glyph，不生成四套。11个reuse不要复制成新字形。各图集PNG使用straight alpha；普通alpha混合即可，不重复预乘。登记均为producer-reviewed，接线和实机验收由Claude完成。

# 裂星远航普通与精英怪物资源

需求版本 `starsea-20261003-d1`；资源版本 `starsea-20261003-monsters-v1`。制作所有者 `monster_art`；主代理独立验收另记。本组只维护自己的源、运行资源与局部清单，不修改生产怪物数值、主线状态、公共资源索引或存档。

## 交付范围

3个跨章兵种、12个本地普通怪、6个精英，共21内容身份。全部提供真实连续 `idle / move / attack / hurt / death / skill`，运行素材为透明PNG与trimmed JSON图集，30 FPS。原生骨架、不同衣装组合、朝向、双色染色和新附件的来源写在 `manifest.json` 与 `sources/*-definition.json`。

- 18项使用已发布MiniFantasy 4.2.43完整原生骨架，衣装、盾、双刃与杖分别组合；并非同一主体换21个名字。
- 铳手使用SP33火枪骨架3.6.32完整动作；灰紫制服、黄铜裂潮徽与青蓝晶核佩件作为真实部件一起导出。
- 两只巡猎兽使用SP33真实四足骨架3.6.32，imagegen修改原始UV布局内毛色与护具；霜脊兽另外调整头部与耳部原生骨轴尺寸。
- 钩、工程面罩、龙角、搬运钳、炉心、种囊、裂潮能源徽为独立imagegen附件，保持真正透明底；手、头与躯干骨轴分别校准。原始生成图保存在本组 `sources/`，运行时不依赖Codex生成目录。

## 构建与自检

在 `open-world` 根目录运行：

```powershell
node assets/starsea/monsters/export.mjs
node assets/starsea/monsters/verify.mjs
```

两条命令只写本组目录。输出位于 `apps/web/public/art/starsea/monsters/`，manifest在本组根目录和公共运行目录各保存一份。保留原始动作时序、完整死亡与原始透明度；只移除原源内阴影、血溅和嵌入式特效，表现由独立VFX组承担。

正式静态主机可打开 `/art/starsea/monsters/preview/index.html`。独立预览也可运行 `node assets/starsea/monsters/serve.mjs 8635`。预览提供六章筛选、全部身份、六动作、左右镜像、暂停/重播和挂点显示。普通80px、厚甲90px、精英110px直接用实测主体高缩放；足点跨动作固定。画布按所有动作及两个朝向的边界容纳长钩和搬运钳，不缩小角色来隐藏裁切。

## 接入字段

每项 `runtime.kind=atlas`，包含 `image / atlas / sockets / frameSize / anchor / scale / displayHeight / fps / nativeFacing / actions`。图集采用Phaser兼容trimmed-frame字段；各动作显式列出帧键、原生动作名、秒时长、帧率、是否循环与 `fallback:false`。

`sockets.json` 每帧提供源画布坐标的足、躯干、手、头、武器/兽口/枪口和地面点。先减 `anchor × frameSize`，乘 `scale`，按朝向镜像，再加世界足点。足点不能替代枪口或兽口。原附件隐藏时，挂点保持该武器或头部原生骨点，来源不是屏幕固定高度。

`ruleReference` 与 `visualSkillReferences` 引用d1规则模板和VFX资源ID。它们记录内容对应关系；新增敌人ID尚未进入正式战斗配置，剧情绑定仍由后续工程处理。

## 验收证据

`evidence/verification.json` 记录文件SHA256、21×6实际浏览器动作连续性、错误与画布边界；`chapter1`到`chapter6`截图分别覆盖6动作与镜像，视口均为1280×720。单角色原生源动作截图、原始骨轴与slot解码、完整帧数及唯一帧统计也在 `evidence/`。

来源、骨架或动画修改必须重新导出并重新验证，最后再由主代理验收。`producer-reviewed` 只代表本组完成自检；正式登录、全局构建、主线可玩与最终接入验收不在本组状态里冒充完成。

## 龙角返修 · 2026-10-04

仅重新导出 `ss-mon-bone-sentinel` 与 `ss-elite-oath-keeper`。原画和全部原生骨架动作保留；头饰宽高分别由130×53调整为104×43、169×69调整为120×50，显示主体仍为90px与110px。

头饰使用原生 `HEAD/headA1/head` RegionAttachment 的实际裁切矩形：完整84×86，可见82×84，四边各1px。将原画角根的不透明中心带位置 `(0.5, 0.62)` 对接至头部可见矩形内额头 `(0.5, 0.16)`，按原附件缩放/旋转转换为头骨局部坐标。原始头像旋转为-90°；校准的角根点为 `(56.23, -6.3)`，头饰中心为普通 `(61.39, -6.3)`、精英 `(62.23, -6.3)`。左右镜像、倾身、受击和倒地都由同一骨轴变换承担，没有屏幕高度补偿。

复验与原尺寸对照保存于 `evidence/dragon-headwear/`：`before/` 与 `after/` 均为1280×720原生预览截图，覆盖idle、attack、skill、hurt、death的两种朝向；`after-verification.json` 同时确认另外19项manifest记录和所有已登记源/运行文件SHA256均未改变。两项新的图集、动作挂点、profile和源定义已更新至局部manifest；全部21项自检仍在 `evidence/verification.json`。

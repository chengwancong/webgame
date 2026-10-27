# 怪物细腻像素候选（2026-10-28）

本文件记录独立怪物子任务；候选只有主代理离线复核批准后才可接入。没有修改正式 manifest、正式数值、碰撞或动作时长，没有提交图片。

## 范围与复现

- 盘点范围：当前 inventory 的 actor、monsters、bosses 三类，共 147 个实际入口，含普通怪、精英、首领、旧章节怪、宝箱怪和首领阶段动作。
- 输入快照：`.runtime/pixel-coherence/monsters/input-manifest.json`。候选清单、明确键与技术报告分别为同目录 `candidates.json`、`keys.json`、`review.json`。
- 离线生成：`node --import tsx tools/pixel/fine-monsters-build.mjs`。单项复现可加 `--only ss-mon-dusk-blade,ss-boss-port-vanguard`；加 `--merge` 才会将明确选项合回已有全量清单，单独使用 --only 会重写清单。
- 动作 contact：`node --import tsx tools/pixel/fine-monsters-review.mjs ss-mon-dusk-blade ss-boss-port-vanguard`。输出留在 `.runtime/pixel-coherence/monsters/review-images/`。
- 网格恢复：`G:/webgame/aw-third-party/pixel-tools/.venv/Scripts/python.exe tools/pixel/fine-monsters-source.py`，本机 proper-pixel-art 处理 28 个全新高密度设计源；不是放大旧 64px 精灵。

## 生产方法

1. 内置 image_gen 只生成透明设计草稿。生成提示词、返回文件路径保留在本地 `generation-record.json`。5 张有效草稿拆出 28 个完整独立轮廓；连在一起或被裁断的早期稿已退回，没有进入来源索引。
2. proper-pixel-art 从真实像素网格恢复原生源，再量化到公共 64 色板；普通源可见高度约 150–185px，首领源约 380–470px。输出比例由旧 actor 的物理显示高决定，画格使用 scale:1。
3. 人形身体使用现有官方 Spine 4.2 加权网格与动作。新源材质绑定到连续 mesh；大型家族的完整特色头像另以原生 source 头片绑定原 head 骨，避免单眼、角和恶魔脸被旧人类头部轮廓裁掉。每一帧通过实际 computeWorldVertices、三角形 UV 逆采样和最近邻采样烘焙。早期独立刚性切片会漂浮肢体，已明确否决。
4. 旧 atlas／legacy 单位的武器从新原画独立切出，去除与主轮廓断开的碎片，按 RIGHTHAND 真实骨骼与原动作朝向校准；不再让法师、铳手共用默认剑。原生首领保留正式高清武器、盾牌与 ss_* 阶段部件，量化到公共色板，以便保留模块开启/关闭的语义。手持层按旧 idle hand→weapon 的显示距离约束，避免大剑攻击越画格；不改变身体比例、判定或攻击时长。
5. 狼、龙和宝箱保持自身解剖结构。狼与龙使用相邻三角形共享顶点的连续表面，避免肢体接缝；普通动作循环、攻击释放和死亡只负责表现，动作总长与命中帧沿用旧表。
6. 不同动作依旧保留原 count、duration、frameTimes、impactTime、impactFrame、cleanup 与阶段键。新增 positions 仅改变图集打包，不改变时序。每张图两边均不超过 4096。
7. 使用自行实现的精确 indexed PNG 编码，PLTE 是主色板原值，透明只有索引 0。libvips 的 palette 自动量化会合并相近色并生成板外值，已排除该导出方法。

## 开放资源裁决

研究代理已经核实 Open Duelyst 整仓 CC0 与 Evil Wizard 2 CC0。Duelyst 实际可见身体多数只有 45–89px，120/140px 画格不代表身体同样大；无法无损满足本项目的 96px 普通怪、120px 精英与 208px 首领时，不能上采样冒充细节。没有将 AI 草稿标为 CC0，也没有擅自改变原项目素材授权。没有下载字体。

## 验收边界

- PNG 校验只证明哈希、色板、透明、动作表、positions、非空帧和挂点满足机器合同，不代表用户美术认可。
- `reviewed:false` 候选不应直接合入 live manifest。主代理可依据实际离线 contact 批准通过的项；失败项应明确留在待修列表。
- 本子任务不运行浏览器、tsc 或整套单测，由主代理统一串行执行集成检查与发布。

## 最终技术统计与风格边界

本组覆盖 147/147 个入口，104 张去重图集，1290 个动作、6642 帧，其中 264 个阶段动作；初次完整 actor checkAsset 与回归脚本零错误。精确 PNG 文件最终合计 17.66 MiB，解码图集由公共 LRU 管理，不能把压缩文件大小当运行时内存。

最终 frame、anchor 均为旧值乘旧 scale，scale 改为 1；bodyHeight 保留 90、96、112、120、150、192、208、216 的体型层级，displayHeight 原值不变。回归脚本为 `node --import tsx tools/pixel/fine-monsters-verify.mjs`；阶段模块挂点复现为 `node --import tsx tools/pixel/fine-monsters-module-sockets.mjs`。

离线已否决关节分离、法师/铳手持默认剑、武器切片残留碎屑、宝箱死亡仍站立张嘴和原生大剑越界的中间产物。最终图仅在新连续网格／武器约束版上审批。第一版大型首领的厚涂金线被主代理明确否决，没有作为最终稿批准。第二版以已认可 misc/v2/travel-meadow-native.png 的簇状尺度编辑 A/B/C 三张 atlas：改为宽甲片、连续衣摆、3–4 阶材质，去掉刻花、细链、碎金属高光与鳞片噪点。主代理已离线批准第二版 A 组方向；B/C 沿用同样输入与边界约束，12 个家族共 56 个入口重新烘焙，普通 16 个家族不重画。最终 source 预览为本地 v2-source-a-208.png、v2-source-b-208.png、v2-source-c-208.png，不能用旧 overview 判断第二版。

## 给真机复核者

最终状态：147/147 候选已完成本子任务离线 source／实际动作 contact 复核，候选 provenance.reviewed 为 true。完整候选 manifest 校验结果为 147 项、104 图、0 issues，真实报告在 `.runtime/pixel-coherence/monsters/final-validation.json`，明确键在 `approved-keys.json`。仍需主代理完成同场景风格复核、正式接入、相关测试与测试服发布；本记录不冒充真机或用户美术验收。

最后复现命令：先运行 `fine-monsters-module-sockets.mjs`、`fine-monsters-verify.mjs`，再以新的 overview-0..3 和 review-images 动作图逐组复核；`node --import tsx tools/pixel/fine-monsters-approve.mjs --reviewed-contacts` 会检查全部来源 hash 为最新，并再次运行完整候选校验后保存审批。此 flag 不能代替实际看图。

1. 同屏普通怪、精英与首领：体型层级应保留，脚底固定在原位置；不能因统一新素材而都变成同高。
2. 铳手必须持铳，法师必须持法杖，持剑单位使用对应剑；观察攻击命中时武器端点和飞行物起点。
3. 连续观察移动、攻击、受击、死亡：手臂、膝盖、靴子不得断开漂浮，武器不得留一份在身体上。
4. 狼倒地和龙收翼必须清楚区别于待机；宝箱闭合、苏醒、张口应可辨认。
5. 首领默认、进入、激活、退出阶段使用同一身份；模块、核心、排气口等 ss_* 挂点不能因换图丢失。
6. 关闭像素开关后应完整恢复原画风；本次不修改原素材及原动作/碰撞/伤害数据。

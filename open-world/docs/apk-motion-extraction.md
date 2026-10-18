# APK 原始动效提取

用户在 2026-10-02 提供 `C:\Users\ccc\Downloads\zjcs_M509085 (1).apk`，先要求只提取，随后授权「完整动态预览和可用性清单，确认哪些能忠实还原，再接入游戏」。当前只将通过原始数据动态验证并有明确用途的金币反馈接入 HUD；其余资源按实际依赖和渲染状态登记。

素材库位于 `G:\webgame\abyss-walker-migration\source-assets\zjcs-apk`，入口为 `index.html`；来源、精确数量、完整性检查和限制见该目录 `README.md`、`extraction-report.json`、`validation.json`。

包含 104 组具名战斗特效／子特效、286 组具名界面特效／子特效、1,711 份 Spine 分段动作、92 份骨骼、93 份图集描述。另保留全部包内 2,658 个 Unity AnimationClip（其中界面片段 439 个）、262 个控制器、8,596 个粒子组件实例以及原生依赖包。

Unity AnimationClip 中存在只调度 Spine 的入口，不能将其数量用作完整动作数。真实动作载荷另在 `spine/original/.../SplitAnimations/*.bytes`；Spine 骨骼版本为 4.2.28。保留原始字节，不擅自重新设计动画。

## 复现

在 `open-world` 目录使用 Python 3.11，安装 `UnityPy==1.25.3`（建议独立虚拟环境），依次运行：

```powershell
python tools/apk-vfx-audit.py 'C:\Users\ccc\Downloads\zjcs_M509085 (1).apk'
python tools/extract-apk-vfx.py
python tools/extract-apk-vfx.py --scope ui --output ../../source-assets/zjcs-apk/ui-vfx
python tools/extract-apk-motion.py
python tools/extract-apk-spine.py
python tools/build-apk-library.py
python tools/validate-apk-library.py
```

工具不安装、不运行 APK；只读取 ZIP 与 Unity 序列化数据。原生包以 APK 内原路径保存，所有路径写入限定在输出目录。原始图像转换为 PNG，仅进行格式解码；预览索引与接触表不改变原始图像。

## 后续接入前必须核对

- 原包有 3 个未解析 CAB 引用；Spine 图集页有未匹配项与多个版本候选。缺失与歧义保留在索引，不能通过通用素材回退伪装完整。
- Unity 粒子、材质、弯曲网格和 Spine 4.2 分段动作需要对应渲染与加载支持；提取成功不能标记原生播放或视觉验收通过。
- 接入必须消费真实事件，保留原始时序／层级／几何，不伪造伤害或持久收益；缺失依赖与不支持的渲染器不能通过重画或通用回退伪装原作还原。

## 动态预览与已接入项目

独立播放器工程：`experiments/apk-motion-preview`；预览地址：`http://127.0.0.1:8625/`。使用官方 Spine WebGL 4.2.120 读取原始 4.2.28 骨骼，保留原始网格、曲线、贴图区域、绘制顺序、混合和逐帧采样。支持动作／皮肤切换、暂停、逐帧、0.25 倍速、时间轴、明暗背景、完整周期录制、透明序列导出及逐项动态验收。

`source-assets/zjcs-apk/dynamic/availability.json` 与 `availability.tsv` 包含 921 条记录：92 份骨骼、390 组粒子特效、439 个界面时间轴。86 份骨骼的 288 个原始动作已验证；其中 286 个有可见图像，两个 `close` 原作关闭状态把所有可绘制贴图 alpha 置为 0，已通过 65 个原始时间轴采样验证其隐藏语义。它们不能被当成缺损画面而补造淡出。

只有独立骨骼内部的原始演出已还原；原游戏外围 Unity 演出与场景照明没有像素对照验证。六份大型组合骨骼仍有未匹配图集或多来源版本，未标记可接入。390 组 Unity 特效需要匹配的原生粒子／着色器执行环境，439 个 UI 时间轴仍需组件绑定与原始布局；它们尚无完整动态预览，未接入。

金币 `goldCoin.skel / loop_goldCoin` 已转为 40 帧、30 FPS、1.333333 秒的透明序列。全部帧使用统一源空间裁剪，未逐帧重新居中或重新设计动作。HUD 只在服务端确认金币余额增加后播放一轮；减少动态模式保持静态。构建源与原始骨骼摘要在 `open-world/assets/apk-native-ui/`，可重复打包且不依赖预览服务。客户端 0.7.4，资产版本 `world-art-20261002-v8-apk-native-ui`；协议／规则／数据库版本未变。

构建、TypeScript、UI token 校验与 10 项现有 UI 测试通过。真实浏览器使用隔离数据库完成账号登录、进入营地、野外战斗、金币到账与回城；主存档未用于测试。所有动态结果与截图见 `source-assets/zjcs-apk/dynamic/captures/` 和 `docs/reviews/apk-dynamic-20261002/`。

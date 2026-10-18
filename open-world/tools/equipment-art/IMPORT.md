# 装备美术导入与验收工具

本工具只生成独立美术包、候选资源登记及离线验收图，不改运行中的 `ui-source.json`、装备数据、数据库或角色槽位。

## 输入

生产清单由同目录 `catalog.mjs` 生成。工具兼容 `items`（也兼容 `icons` / `assets`）列表；每项须有 `id`、`name`、`setId`、`direction`、`series`、`tier`、`slot`。六部位按清单中的 `slots` 或 `scope.slots` 定义。

每张原图可以由清单 `source` 指定，路径相对清单文件；也可统一放在独立原图目录，用 `--source-dir` 按 `${id}.png` 读取。指定 `--source-dir` 时优先使用该目录，避免将计划中的正式输出路径误当成已生成原图。

## 导入

从 `open-world` 目录运行：

```powershell
node tools/equipment-art/import.mjs --manifest ../docs/05-art/equipment-icons-handdrawn-20261001/catalog/with-primal.json --source-dir assets/ui-source/v2/equipment-handdrawn-originals --out assets/ui-source/v2/equipment-handdrawn-package
```

分批可以追加 `--only-set gear-standard-hidden-t1,gear-standard-wand-t1`；所选每套仍须六部位齐全。输出目录必须不存在或为空，重做时选择新的输出目录，避免覆盖已验收原图。

导入流程验证 PNG 与透明通道，以 alpha 可见边界裁去外围空白，等比缩放到 208px 安全区域，居中放入透明 256×256 画布。原始 PNG 原样保存在 `originals/`，正式图在 `icons/`。校验原图与归一化图的像素哈希，不允许重复图冒充不同装备；哈希只能发现完全重复，造型雷同仍需人工检查。

所有输入成功才发布完整目录。失败时删除本次专属暂存目录，保留之前的输出。接触原图画布边缘的素材会留下裁切风险提示，必须肉眼检查。

输出 `manifest.json` 记录来源、归一化方法、原图/正式图哈希及大小。`ui-source-entries.json` 只是候选资源条目；合入现有资源构建前必须添加正确子目录前缀并检查稳定 ID 不冲突。

## 验收

```powershell
node tools/equipment-art/review.mjs --manifest assets/ui-source/v2/equipment-handdrawn-package/manifest.json --out ../docs/reviews/open-world/equipment-icons-handdrawn-20261001
```

使用本机 Chrome 无头浏览器，无需启动游戏或数据库。输出全量与各方向/系列的 HTML、PNG、`result.json`，按 T1/T2/T3 每行六部位展示。每个装备实际渲染 80px、32px、48px，测量显示尺寸、256px 原图大小与横向溢出。透明画布以游戏午夜蓝底显示。

技术检查通过不自动代表美术完成或运行版已接入。仍需审阅每套六件是否统一，三个 Tier 是否在结构上递进，三个系列是否可辨，以及小尺寸能否辨认主体。最终接入时另验收背包、详情与选中状态的图标槽位稳定性。

## 整库登记

最终全量为 54 套、324 张。完成目视检查后，将包清单字节的 SHA-256 写入 `visual-review.json` 的 `packageSha256`，并记录 `status: approved`、`iconCount: 324`、`setCount: 54`。

```powershell
node tools/equipment-art/publish.mjs --package ART_PACKAGE/manifest.json --review visual-review.json
```

登记工具核对验收指向的包版本及每张正式图哈希，将正式 PNG 复制到 `assets/ui-source/v2/equipment-handdrawn`，保留现有 UI 资源并追加 324 个稳定 ID。它还生成同目录 `catalog.json`；该清单是美术库，不是数值装备或掉落表。实际公开路径统一为 `/art/ui-v2/equipment-handdrawn/<id>.png`。

`record-provenance.mjs` 按最终原图哈希匹配各 Agent 的生成记录，输出全部 324 个真实提示词、参考图及来源；定向修订使用过的旧版图保存在原图目录的 `revisions` 中。

按项目要求停止服务、构建 UI 资源和网页、恢复服务后，运行：

```powershell
pnpm content
node --import tsx tools/equipment-art/accept-published.mjs
```

后者使用实际本机服务检查 health/content 版本一致、无密码账号登录、进入安全营地、会话恢复及 324 张正式图解码，不修改已有玩家的装备或成长。

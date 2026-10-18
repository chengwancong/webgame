# 养成界面与声望修复方案（交给实现者）

状态：已完成（未提交 Git；验收记录见下文）。

日期：2026-10-05。工程：`G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world`，本机服务 `http://127.0.0.1:8612`。
目标：新角色（2 级、星海主线第 1 章）打开「养成」时，一眼看懂**现在能做什么、以后会开放什么**，不再出现整屏锁格、看不懂的数字和重复提示；声望在星海主线中真正能涨。

---

## 0. 必须遵守（违反即返工）

- 先读仓库根 `AGENTS.md` 和 `项目.md`。持久状态只由服务端修改；客户端只显示服务端解析结果，不复制公式。
- 颜色、字号、间距只用 `packages/ui-tokens/tokens.json` 生成的 Token；控件只用 `apps/web/src/ui-components.ts` / `apps/web/src/ui/`，不新建按钮、状态块、对话框样式。
- 版本分开升：客户端改动升 `client`，规则改动升 `rules`，契约结构改动升 `protocol`。位置：`packages/contracts/index.ts` 第 28 行附近 `versions`。当前 `client 0.10.15 / protocol 19 / rules ow-34 / db 12`。
- 不改、不删：`tools/build-skill-fx.mjs`、`apps/web/src/combat-vfx.ts`、`vfx-profiles.ts`、`wardrobe-v2-review.html`。
- 开发登录只输账号名，不要密码。测试用真实数据库，不 mock。不得关闭版本校验。
- 本机性能差：浏览器验收、vitest、数据库任务**一次只跑一个**。
- 完成后：`npx tsc --noEmit -p .`、`npx tsx tools/validate-content.ts`、相关 vitest、`curl /api/health` 版本一致、真实浏览器登录进游戏截图。不要提交 git。

## 1. 已完成，不要重做

以下在 `apps/web/src/progression-panel.ts` / `progression-panel.css` 已落地（客户端 0.10.15）：

- `sectionLocked(section)`：模块内条目全锁且没有可执行操作时，内容区只显示一张居中「XX尚未开放」状态卡 + 第一条开放条件，详情栏隐藏。
- 整组全锁时，左侧分组页签与顶部模块页签带锁图标。
- 模块页签去掉了条目计数（原来的 48 / 55 / 12 / 6）。
- 天赋点显示为「◇ 可用天赋点 1」。
- 多个操作按钮因同一原因不可用时，原因只显示一次（`reason-shared`）。
- 任务追踪进度条 `.meter.neutral` 填充改为 `--color-primary`（原深棕底深色字看不清）。

截图参考：`.design/progression-audit-20261005/`。

---

## 2. 任务 A（规则 + 内容）：声望接入星海六岛　【优先级最高】

**问题**：`packages/rules/deep-progression.ts` 的 `awardProgression` 用 `faction(meta.region)`（只去掉 `-boss` 后缀）匹配 `deep-progression.json` 的 `factions`（meadow / forest / rift / tundra / abyss / dragonbone）。星海地图 id 是 `ss-map-*`，永远匹配不上 → **星海主线里声望永远是 0**，界面还显示旧地区名。

**方案**（保留旧阵营 id，不迁移存档）：

1. 在 `packages/content/starsea/` 增加岛 → 阵营映射（放内容源，不写死在规则里）：

   | 星海地图 | 阵营 id | 星海显示名 |
   |---|---|---|
   | ss-map-wind、ss-map-boss-1 | meadow | 风栖岛 · 船台守望者 |
   | ss-map-mist、ss-map-boss-2 | forest | 雾铃岛 · 林间邮差 |
   | ss-map-forge、ss-map-boss-3 | rift | 赤炉岛 · 炉火工匠 |
   | ss-map-frost、ss-map-boss-4 | tundra | 霜镜岛 · 观测站 |
   | ss-map-rift、ss-map-boss-5 | abyss | 沉星岛 · 难民营 |
   | ss-map-dragon、ss-map-boss-6 | dragonbone | 龙眠岛 · 誓约守卫 |

   `ss-map-port`（拾星港）不产生声望。
2. `faction()` 先查该映射，再走旧逻辑。数值不变（普通 1 / 精英 5 / 首领 30）。
3. 声望视图（`deep-progression.ts` 第 232 行附近生成 reputation section 处）：角色有 `s.starsea` 时用「星海显示名」，排序按岛的章节顺序；没有 `starsea` 的旧角色保持原名。
4. 阵营说明文字不再是「友善100 / 尊敬400 / …」这种数值表，改为玩家语言，例如：「在风栖岛击败怪物可提升声望，首领给得最多。达到尊敬可领取稀有护甲。」门槛数值放到进度条刻度和 tooltip。
5. 升 `rules`（→ ow-35）。新增测试 `tests/starsea-reputation.test.ts`：在 ss-map-wind 击杀普通/精英、在 ss-map-boss-1 击杀首领，分别给 meadow +1/+5/+30；拾星港不给；旧地图 id 行为不变。用真实规则函数，不 mock。

## 3. 任务 B（客户端）：天赋页「未选专精」状态

**问题**：没选专精时画 6 行 × 5 列 30 个锁格 + 左侧 6 个锁圈，右侧详情一大片空白，玩家只能看到一个「设为主专精」。

**方案**（`progression-panel.ts` 的 `talentTreeHtml` 与对应 CSS）：

- 当前分支专精未选（`spec.state!=='learned'`）时，不画整棵树，改画一张**专精介绍卡**：分支图标（`spec-warrior/mage/ranger`）、专精名、一句定位（取 spec.description）、5 个属性列图标 + 名称作为「这一系能加什么」的预览，底部主按钮「设为主专精」（或副专精，沿用服务端 operations）。
- 已选专精后才显示天赋树。树里**只有已解锁层和下一层**显示节点；再往后的层折叠为一行「第 3–6 层：投入更多点数后开放」。
- 层号锁圈（`.talent-tier-rail`）只在已解锁层显示数字，未解锁层不再逐行重复锁图标。

## 4. 任务 C（客户端）：天赋节点信息量

**问题**：节点只有灰色图标 + 一个小点，看不出加什么、加多少。

**方案**：节点图标下加一行数值（取 `effects[0].value`，如「+2%」），满级显示对勾角标（已有）。名称仍只在列头、title、aria 与详情。

> 注意：这一条与 `docs/reviews/ui-game-feel-20261005` 图形化文档 C11「格内不写数值」冲突。用户 2026-10-05 明确表示当前前端显示问题很大，本方案以可读性优先；若用户另有指示以用户为准。

## 5. 任务 D（客户端）：详情栏

**问题**：所有条目的详情头像都是同一个书本图标（`symbol()` 兜底 `hudIcon('build')`），下面大片空白；描述里有「前置：起点；攻击 +1%」这类开发口吻。

**方案**：

- 头像按模块取图：天赋 → 该节点属性图标（`statIcon`）；巅峰节点 → `diamond`/`plus`；雕文 → `skillRadius`；突破/觉醒 → `star`；声望 → `chest`；技能觉醒 → 已有 `skillArt`。只用 `ui/icons.ts` 已有图标，缺的才按手绘符记风格补。
- 详情内容固定三段：**效果**（statRow 列表）→ **条件 / 消耗**（服务端报价）→ **操作按钮**。没有内容的段不渲染，按钮贴在底部，空白由内容区自然收缩，不要留整块空板。
- 巅峰节点描述改为玩家语言：「需要先点亮相邻节点」而不是「前置：起点」。文字来源在服务端 `deep-progression.ts` 的视图生成处修改（不是在客户端拼）。

## 6. 任务 E（客户端）：未开放模块卡补充

在已有「XX尚未开放」卡上：

- 补一行「开放后可以：……」（取 section.description 第一句）。
- 锁定时隐藏顶部 ⓘ 帮助和「总加成」按钮（没有任何加成可看）。
- 未开放模块在左侧分组里排到已开放模块之后。

## 7. 任务 F（客户端）：声望卡片布局

`progression-layouts.ts` 的 `reputationCardsHtml`：档位点阵现在悬在卡片中间，进度条末端宝箱图标被裁切。改为：第一行「名称 ········ 档位名（如 中立）」，第二行进度条，宝箱刻度完整显示在条内；卡片高度统一。

## 8. 任务 G：修复已有失败测试

`tests/progression-layouts.test.ts` 有 2 条失败（期望文本「已达最高档」「战士雕文 Lv5」），是 09:26 对 `progression-layouts.ts` 的改动造成的，不是本方案引入。按当前实现的语义（文字移到 aria-label / title）更新断言，或恢复对应文本，二选一并说明理由。

## 9. 任务 H：剩余文字检查（运行时）

静态扫描与 8 个主面板已检查完毕。还缺只在战斗中出现的内容：战斗飘字、掉落提示、首领战 HUD、副本准备/结算、死亡结算、登录与建角页。逐个触发，把可见文字读一遍，开发口吻（核验、报价、同步、版本、配置、玩家已…、占位）一律改成玩家语言。QA / 验收 / 预览页不用改。

---

## 10. 验收清单

用新账号（只输账号名）登录：

1. 养成 → 三系天赋：未选专精看到介绍卡而不是 30 个锁格；设为主专精后只看到第 1–2 层，节点下有数值。
2. 巅峰雕文 / 突破觉醒：显示「尚未开放」卡 + 开放条件 + 开放后能做什么；没有 ⓘ 和总加成。
3. 去风栖岛打 3 只普通怪 → 区域声望里「风栖岛 · 船台守望者」进度 +3，其他岛不变。
4. 详情栏头像随模块变化，无大片空白，同一原因只提示一次。
5. 1280×720、1024×768、375×812 三个尺寸无横向溢出、文字不被裁切，连续切换页签布局不跳动。
6. `/api/health` 版本与客户端一致；控制台无 pageerror。
7. 附改前 / 改后截图（放 `.design/progression-fix-20261005/`）和测试结果。


## 11. 执行与验收结果

2026-10-05：任务 A–H 已完成。服务端使用内容映射保留原阵营存档键；新增可选 `tierUnlocked` 元数据，天赋树按服务端层级状态显示。界面继续使用现有 Token、公共控件与图标，没有新增位图素材或平行控件皮肤。

78 项相关单测、10 项真实 PostgreSQL/API 测试通过；类型检查、内容校验、Token 校验与生产构建通过。浏览器验证三个指定视口、真实专精与天赋操作、三只普通怪的声望 +3 及刷新保留，以及副本准备/首领 HUD/结算/死亡文案。

本次版本增量为 client 0.10.16 / protocol 20 / rules ow-35。执行期间同工作区还有其他修改，最终实际版本与完整证据记录在 [.design/progression-fix-20261005/result.md](../.design/progression-fix-20261005/result.md)。本次不提交 Git。

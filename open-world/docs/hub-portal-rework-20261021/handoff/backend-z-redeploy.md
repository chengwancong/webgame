# HUB-Z 补发布：宠物全玩法获取 + ART-HF 前端接线（交 GPT）

> 强制执行：Z7→Z9 连续做完，不在批次间停下问；遇到非硬阻塞按默认裁决继续，并在 `backend-z-progress.md` 末尾追加 Z7–Z9 勾选与证据。

## 背景（Claude 已提交 1f5e5741 及其后续提交）

- 宠物三档只是稀有度、全部靠玩法获得（用户 10-23：先做可玩性）。常见档被动改为攻击 +3% + 生命 +4%；新增规则 `huntPet`（传说档）；`hub-explore.json` 里 100% 的奖励文案改为「获得该岛稀有宠物」。依据见 M17「来源」一节。
- 前端接线 ART-HF：航图探索圆环（底框 + 三段弧，conic 遮罩）、钥匙图标与秘藏图标、共鸣徽记 0–5、部位格框（普通/满级/受限）、阵容框（上阵/助阵与空位）、流派选中底；场景秘藏/锁门道具只传 manifest 已声明的状态，并且总是预载。
- 本机已过：tsc，`tests/zhangjian-frontend.test.ts` 和 `tests/zhangjian-rules.test.ts` 共 36/36，vite build。

## 批次

- **Z7 回归**：玩家可见文案「零氪 / 轻氪 / 重氪」已改为「常见 / 稀有 / 传说」，服务端回执和日志里如有残留一并改掉。串行跑 zhangjian 相关单测和 PG（zhangjian、hub-chart、hub-outside、hub-dungeon-instance）。凡是断言了零氪被动数值的旧测试，统一改成新值，不改规则。
- **Z8 传说宠物开放**（用户 10-23：先做可玩性，不考虑商业化）：
  - 在狩猎节点或关口首通结算时调用 `huntPet(region, chart.cleared)`（`packages/rules/zhangjian.ts`），有结果就 `grantPet`，回执文案沿用关口宠物的格式。
  - 老角色登录回填：已满足条件但没有该宠物的，补发一次。
  - 图鉴里传说档改为显示来源「狩猎与关口都首通」，不再显示「暂未开放」。
  - 加 PG 用例：只打狩猎不发；狩猎加关口发一次；重复结算不重复发；老号回填。
  - 不再做付费占比测量；Z5 的数值残差结论作废，不用补测。
- **Z9 发布**：
  - 版本号改为 0.11.53 / protocol54（协议没变就不升）/ ow-94 / db19。
  - 把 `packages/asset-manifest/hub-hf.v1.json` 的 status 改为 `wired`。
  - 同批带上 Claude 已提交的五批美术接线（ART-FP d9899c1e、HB b7fab676、HC e5f1a0cf、HD 3900a20c、HE 1d0aef05）；部署后让 Grok 看港口建筑与头顶标记、航图节点、副本采集点/信标/潮印卡框、背包品质框。素材照旧走部署脚本同步，不进 Git。
  - 照常提交和云部署，核对 health/content/build-info 一致。
  - 在 progress 里回填部署时刻和提交号。

## 默认裁决

- 如果 PG 里有和本批无关的旧失败，记录下来后继续，不去修。
- 全局 `spine:check` 引用 ow-76 的问题照旧，不在本批处理。
- 素材、截图和原始测量不进 Git。

## 硬阻塞（只有这些才停）

- 云部署失败，且重试一次仍然失败。
- health 返回的版本和 build-info 对不上。

## 安全

测试服口令只存在 `G:\webgame\aw-deploy\staging-credentials.txt`，不得写进报告、日志或链接。不用控制台改角色、钱包、等级、任务或奖励，不清库。

## 完成定义

- Z7–Z9 全部勾选。
- 云端版本为 0.11.53 / ow-94。
- 传说宠物可在测试服按玩法获得，并有 PG 覆盖。

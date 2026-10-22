# HEX-F03 前端任务书（给 Sonnet 子代理；B08 的 contracts 合入后启动）

依据：`d13-affix-rework.md` §3/§4，图标 `d09-hex-icons.md`，文案 `d08-hex-copy.md`，提示现状 `apps/web/src/hex-rune-tip.ts`（HEX-F02 已交）。

## 启动条件
`packages/contracts` 中已无 hex1/hex2/hexSlotAccess，`gearSchema.hex`、`snapshot.hexActive` 存在（git grep 确认）。未满足则不动手，回报“依赖未就绪”。

## 改动清单（只改 apps/web，不碰后端共享源与他人未提交改动）
1. 删除 `hex-rune-chooser.ts`、`hex-rune-slots.ts` 及其在 `CharacterPanel.ts`、`CharacterPaperdoll.ts`、`main.ts`、`presentation.ts` 的引用；`hex-rune-view.ts` 去掉槽位输入，改导出 `hexAffixOf(gear, hexActive, catalog)`：返回 `{runeId, tier, active, reason}`。
2. `equipment-slots.ts` 删 `isHexSlot` 与 hex1/hex2 标签。
3. 装备提示：普通词缀下加一行 HEX（六角图标 + 品质色名 + 一句效果）；`active=false` 整行置灰，reason=duplicate/group 显示「同类已有更高品质」；打法标签/适合谁/取舍沿用 hex-rune-tip.ts。
4. 纸娃娃：6 部位格右上角给带 HEX 装备小六角角标（未生效则灰）。
5. 背包筛选新增「带海克斯」；背包格同样用角标。
6. 对比预览：把新装备的 `hex` 与当前 `hexActive` 对比，显示“将生效/将失效/不变”，数据只用服务端字段，不自行复算去重。若服务端暂无预览字段，只显示新装备自身 HEX 状态，不猜。
7. 设置页与引导对白里的 HEX 说明改为“装备词缀，只随掉落”；不得出现槽位、镶嵌、选奖、碎片字样。
8. 共鸣（≥3 同打法）：若 hexActive 或 snapshot 提供共鸣标记则在纸娃娃下方显示一行小字，否则跳过。

## 自测
`pnpm exec tsc --noEmit -p apps/web`（只看本批文件无新增错误）；改写 `tests/hex-ui-retest.test.ts`/`hex-equipment.test.ts` 中前端相关断言后单文件跑；不跑 headless、不跑全量。应用内浏览器只做一次冒烟（装备提示、纸娃娃角标）。

## 提交
`git commit --only -- <自己的路径>`，信息 `feat(web): HEX-F03 …`，末尾 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。

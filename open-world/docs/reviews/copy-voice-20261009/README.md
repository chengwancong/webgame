# 文案验收复现

在 `open-world` 目录运行。所有步骤只使用脚本新建的临时库；不要把正式 8612 的存档连接串传给测试。

1. 运行 `node tools/copy-voice-host.mjs`，保持终端打开，等待 `COPY_GUI_READY`。宿主记录在 `host.json`，改前/改后 API、Vite 与回归数据库均隔离。
2. 顺序运行以下可见 Chrome 验收。固定 1280×720，关闭窗口后继续下一项：

   ```powershell
   pnpm exec tsx tools/verify-copy-voice.ts --before --ui
   pnpm exec tsx tools/verify-copy-voice.ts --before --battles
   pnpm exec tsx tools/verify-copy-voice.ts --ui
   pnpm exec tsx tools/verify-copy-voice.ts --battles
   pnpm exec tsx tools/verify-copy-voice.ts --before --keys
   pnpm exec tsx tools/verify-copy-voice.ts --keys
   ```

3. 运行 `node tools/prepare-copy-voice-build.mjs`。在它输出的 `source` 目录完整运行 `pnpm build --outDir <output>`。源码、素材、配置和文档被复制，依赖目录只做连接；构建资源发布不会替换正在预览的原目录。
4. 回到原目录运行 `pnpm exec tsx tools/verify-copy-voice.ts --production`。它登录上一步战斗验收的既有账号，检查角色 ID、实际装备数量、刷新后的会话、health/content/源码版本一致性。
5. 回归使用 `tools/playability-vitest.config.ts`，将 `AW_DATABASE_URL` 设为宿主连接串中的 `copy_regression_short` 数据库。整套回归的两个长流程单独运行，避免一个用例的超时异步任务污染下一个文件。

   ```powershell
   $copyHost = Get-Content docs/reviews/copy-voice-20261009/host.json -Raw | ConvertFrom-Json
   $env:AW_DATABASE_URL = $copyHost.dsn -replace '/postgres$','/copy_regression_earned'
   $env:AW_CALENDAR_STRATEGY = 'no-quests'
   pnpm exec vitest run --config tools/playability-vitest.config.ts tests/world-natural-calendar.database.test.ts
   $env:AW_CALENDAR_STRATEGY = 'attempt-all-tasks'
   pnpm exec vitest run --config tools/playability-vitest.config.ts tests/world-natural-calendar.database.test.ts
   Remove-Item Env:AW_CALENDAR_STRATEGY
   pnpm exec vitest run --config tools/playability-vitest.config.ts tests/earned-all-quests.database.test.ts
   ```

   保持原测试时限。自然日程输出到既有 `docs/reviews/open-world-m2-m4/W10/`；全任务测试依赖新的 `natural-calendar-attempt-all-tasks.json`。全任务测试会明确区分自然装备的结果和剩余地城使用合法既成装备的可达性，不能合并声称自然全通关。

6. 结束时把 `host-control.json` 的 `stop` 改为 `true`，等待宿主输出清理完成；`cleanup.json` 记录临时库已停止、临时目录已移除。

`host.json`、`host-control.json`、`build-location.json` 是本机临时位置，不作为固定配置提交。截图、成功的浏览器记录、检查日志（只清理行末空白）、完整盘点和最终报告保留在本目录。

改前基线的限制见 [report.md](report.md)：旧提交没有挂载难度控件，不能把设计样板冒充旧版实机截图。

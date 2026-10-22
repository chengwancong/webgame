# 深渊行者 · 大世界版本

## 许可证

本工程自行开发的源代码采用 **GPL-3.0-or-later**，即 GNU GPL 第 3 版或你选择的任何后续版本。完整条款见仓库根目录的 [LICENSE](../LICENSE)，第三方代码与非代码素材的授权范围见 [NOTICE.md](../NOTICE.md)。

前端字体、排版、颜色、控件与装备 Tips 采用根目录 [项目 UI 标准](../项目.md)。用户确认的装备 Tips 为竖版单列，标准图与实施规则均记录在该文档。

全局UI系统正在迁移：唯一Token源、公共组件和交互工作台已建立，已接入身份入口、通用标题和确认窗口。[设计系统](docs/ui-design-system.md) · [完整进度与剩余范围](docs/ui-system-progress.md) · [组件工作台](http://127.0.0.1:8612/ui-system.html)。未完成的专用页面继续保留在整体目标内。

2026-10-02：任务界面已接入常驻多任务列表、可扩展平级分类和领奖后的完整档案，沿用真实任务与奖励。当前客户端0.7.1／协议8／数据库10，旧存档缺失记录不补造；[实现与验收](docs/task-journal.md)。

独立于之前 Godot/Python 原型的 TypeScript + Phaser + Fastify + PostgreSQL 工程。角色、敌人使用用户提供的资源；地图是可走动的斜视世界，支持手动、半自动和全自动。

## 运行

Windows 本机常驻服务已适配。首次准备运行 `pnpm setup:windows`：安装锁定依赖、按需下载 PostgreSQL 18.6 独立二进制、核对已有游戏资源并安装服务。此方式跳过 Electron 桌面可执行文件下载；网页服务不依赖它，桌面调试前另行运行 `pnpm rebuild electron`。

安装后双击「启动服务.cmd」，或用 `pnpm service:start`；管理入口为「停止服务.cmd」「重启服务.cmd」「查看服务状态.cmd」，对应 `pnpm service:stop`、`pnpm service:restart`、`pnpm service:status`。服务隐藏运行，当前用户登录后自动启动，组件和托管进程异常退出后自动恢复。停止会关闭登录自启，直到再次启动；数据库保存在 `.runtime/dev/data`。

游戏地址为 http://127.0.0.1:8612/ 。本机服务沿用内网账号模式，不需要密码，首次输入账号会创建账号。详细机制与限制见 [常驻服务说明](../docs/04-open-world/local-dev-service.md)。Windows 构建前先 `pnpm service:stop`，完成 `pnpm build` 后再 `pnpm service:start`，避免 Vite 文件监视器锁住待发布资源目录。

需要 Node 24、pnpm、Python/Pillow，以及 PostgreSQL 18。当前机器 PostgreSQL 路径已支持；其他机器用 `AW_PG_BIN` 指定二进制目录，或用 `AW_DATABASE_URL` 指向**专属于新版**的数据库。不能使用旧版数据库。

```sh
cd /Users/chengmocong/Documents/ChatGPT/abyss-walker-rewrite/open-world
pnpm install
python3 tools/build_assets.py
pnpm dev
```

打开 http://127.0.0.1:8612/ 。也可以双击本目录的「启动深渊行者.command」。开发期只输入账号登录，账号为 3–32 位字母、数字或下划线；首次使用自动创建账号，同名账号继续原角色进度。直接启动 API 也默认使用此模式。

开发数据库保存在 `.runtime/dev/data`，正常退出停止数据库和服务，保留本版账号成长。QA 使用另一个一次性数据库，成功和失败均停止并清理。两个存储不混用。

Mac 常驻预览使用 `pnpm service:install`：登录后自动启动，组件退出后自动重启，不依赖终端窗口。查看状态用 `pnpm service:status`，停止用 `pnpm service:stop`。常驻服务运行时不要同时运行 `pnpm dev`。系统可能要求允许 Node 访问“文稿”目录；详见 [本机常驻服务说明](../docs/04-open-world/local-dev-service.md)。

键鼠：WASD/方向键移动；点击地面寻路；点击敌人选择目标；1–4 施法；E 交互；B 背包；K 技能；空格暂停；Esc 关闭面板。设置可重新绑定按键。全自动需要主动开启，移动输入立即切为半自动。

副本从营地「副本」目录直接进入，不必先走到结界。普通关卡完成配置的清怪与精英目标后进入首领阶段；独立试炼分别校验前置条件。新副本由服务端执行，实时与自动团队保留独立成员，战斗不因面板、后台或断线暂停，掉落自动入包；开战冻结装备和技能，结局返回营地。规则、接口及验收见 [副本生命周期](docs/dungeon-lifecycle.md)。野外继续采用已修复的清场规则；第一关首通与原掉落数据保留，详见 [难度与掉落修正](../docs/04-open-world/first-chapter-balance-20261001.md)。

## 验证与工具

```sh
pnpm content       # Tiled 地图、出生点、动作与技能检查
pnpm test:core     # 直接运行游戏核心
pnpm check         # 构建、真实 PostgreSQL、浏览器完整流程、容量、恢复、桌面、压力场景
pnpm balance       # 三构筑 × 三等级 × 五固定种子；运行真实核心
pnpm build         # 正常发布构建，不包含压力测试入口
pnpm desktop       # 先 pnpm build；API 需运行，默认 localhost:8611
```

`AW_DESKTOP_API` 可指定桌面 API 地址。Electron 加载本地打包文件，通过受限本地 HTTP 代理访问 API，不加载远程游戏页面。Steam 发布和 Windows 实机不因这个命令启动成功而自动通过。

地图源在 `packages/content/maps/world.world`，可直接用 Tiled 打开。对象层坐标为逻辑格×32像素，渲染再投影为斜视地图。不要在渲染代码里另写碰撞或出生点副本。

源素材来自相邻旧工程，只读取 PNG 和动作元数据，不运行旧转换器、不修改旧表。`tools/build_assets.py` 生成图集和来源记录。缺少原始素材时须先恢复资源目录；不自动用其他角色替代。中文字体随包保留 OFL 许可。

设计目标、当前完成边界及证据见上级 `docs/00-project/open-world-development-outline.md`、`docs/04-open-world/implementation-status.md`、`docs/reviews/open-world/`。当前是可玩开发版本，正式地形、音乐、长时间验证及平台发布另列，不把设计稿当成完成证明。

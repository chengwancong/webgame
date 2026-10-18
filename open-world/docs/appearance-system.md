# 分件换装系统与第一批资源

2026-10-02更新：初始100011/100041旅装已接入MiniFantasy藏蓝原生Spine角色，营地、战斗、头像、人物页和预览同步使用。100011单手剑、300601双手剑、400105法杖按真实外观ID映射；其他衣装/武器保留下面描述的原分件路径。完整接入、时序、检查与范围见[MiniFantasy正式接入](mini-hero-integration.md)。

2026-10-01。营地「外观」入口提供七部位预览、混搭、保存和恢复自动外观。界面沿用 `项目.md` 的字体、控件与 V2 色系；人物实际拼装同步到营地、战斗、HUD 头像和背包。

## 实际范围

| 项目 | 当前实现 |
| --- | --- |
| 可选部位 | 头部、衣甲、手部、裤装、靴子、背部、武器；一次保存完整选择。 |
| 资源复用 | 本机 `D:/2D/assets/man/主角/spineaaa` 的 226 组、3164 张分件完成盘点。第一批挑选并发布 16 套、224 张原始分件；其余 210 套仅登记，等待逐批美术复核。 |
| 动作 | 剑、斧、弓、枪、拳、矛、魔法七类源动作；每类十种动作，30fps，总计1396帧，使用真实骨骼矩阵与源遮挡顺序。游戏已有主手配置实际驱动剑、弓与徒手；其余家族是已验证的内容扩展能力，不冒充新增武器玩法已经上线。 |
| 微调 | `100011` 头部采用版本化 ImageGen 微调：保留棕发身份，柔化线条、阴影和高光，按原 96×96 画布与 alpha 包围盒对齐。其余已发布部件保留原图；人物身高、地面锚点及采样方式统一。 |
| 自动装配 | 根据真实主手匹配武器外观及动作，副武器盘不影响手持模型。其余部位按衣甲配置匹配。原素材后发可能在 `back_parts`，自动背部与已选头部配套，显式背部仍可独立覆盖。 |
| 外观收集 | 四套初始衣装，其他按实际装备收集、地区开放条件解锁；已确认收集保留。装备自带的自动武器造型不等于获得整个衣装套件。 |
| 纯外观行为 | 预览不写存档；保存仅更新外观与角色 revision，不修改金币、属性、build、战斗授权或战斗时钟。 |

原素材有明确边界：`face` 合并脸、发型及部分头饰，`hands` 含手臂和手，`back_parts` 可能包含后发或披风。因此当前自由组合的是实际七个素材分组，不能宣称脸、肤色、发型、头盔已经完全独立拆分。后续可按内容批次补独立原件。

## 数据和工程入口

- `packages/contracts/appearance.ts`：选择、状态、服务端预览、展示契约及七部位严格校验。
- `packages/content/appearance.json`：默认衣装、实际装备到造型/武器类别映射、衣装名称和解锁条件。
- `packages/rules/appearance.ts`：唯一的拥有权、部位、武器类别、自动回退与预览解析。
- `apps/api/src/app.ts`：`GET appearance`、`POST appearance/preview`、`appearance/apply`、`appearance/reset`，复用事务、控制租约、revision、幂等回执及流水。
- `apps/web/src/appearance-controller.ts` / `appearance-panel.ts`：页面草稿与服务端预览，不在客户端决定拥有权。
- `apps/web/src/wardrobe-renderer.ts`：十四分件加载、矩阵拼装、原子切换、暂停、镜像和头像派生；整组资源就绪前保留原角色，失败后重试。
- `assets/wardrobe/selection.json`：第一批资源、源动作映射及表现释放帧。
- `assets/wardrobe/weapon-sockets.json`：实际 PNG 刀尖、枪口、杖头及双手拳面像素点。
- `assets/wardrobe/style-overrides.json`：按 profile/set/part 的非破坏微调覆盖。
- `packages/asset-manifest/wardrobe.json`：发布文件、来源 SHA256、自然尺寸、地面点、武器类别与按需加载元数据。

迁移 9 只增量补充外观字段和已满足的收集条件，保留原账号、钱包、装备、成长、战斗授权和历史回执。旧回执仍按原内容返回。切换实际主手后，已保存的不兼容武器外观自动回退；换回对应类型时可恢复原覆盖，新的不兼容选择则拒绝。

## 资源构建与动作对齐

```powershell
node tools/wardrobe-import.mjs
node tools/wardrobe-build.mjs
node tools/wardrobe-verify.mjs
node tools/accept-wardrobe-renderer.mjs
node tools/accept-appearance-ui.mjs
```

开发导入可读本机原件，正式构建仅使用工程内已保存的 source/sets/previews/stylized 及清单；部署无需 D 盘、Spine 安装或激活信息。`pnpm build` 已加入可复现分件构建。公开资源保持一类动作和当前十四分件按需载入。

播放沿用战斗时钟。源动作表现释放帧映射到真实技能前摇，暂停时骨骼与挂点冻结，投射物命中继续由战斗核心判定。Canvas 图像只参与显示，不发奖、不计算伤害或修改碰撞。

挂点使用“原 PNG 像素→当前附件局部坐标→真实逐帧矩阵→缩放/地面/镜像”的同一变换。刀刃、枪口、弓释放面和杖头分别标定；拳使用当前手部的前后拳面，按当帧实际出拳前缘选取。缺元数据时保留有记录的原骨骼回退。配置检查尺寸、边界、alpha 非空和哈希，避免固定屏幕偏移。

## 微调版本与证据

本次使用内置 `image_gen`。原生成图、规范化输出与提示词保存在 `assets/wardrobe/stylized/`。原始 D 盘素材和 `sets/` 原件未覆盖。对照图为 `assets/wardrobe/review/style-100011-native.png` 与 `style-100011-v2-soft.png`，均由真实矩阵拼装；不以概念图代替实机。

UI 验收记录在 `../docs/reviews/open-world/appearance-ui-20261001/`，覆盖七部位真实保存、重登恢复、头像/背包/战场一致、旧预览在慢载期间保留、报价失败、真正提交后丢响应并恢复唯一回执/流水，以及 1280×720、1024×576、1600×900、1920×1080、375px 的连续选择、卡片内容包含、滚动、焦点和窄屏键盘可见性。

渲染验收记录在 `../docs/reviews/open-world/wardrobe-renderer-20261001/`。资源数学验证比对78176个顶点，最大差异0.000145；仅证明实际支持的正常骨骼/RegionAttachment子集。网格、IK、未知约束等新素材能力会在导入时拒绝，需要新增实现及测试，不能静默降级为假动作。

工程与实际本机验收保存在 `../docs/reviews/open-world/appearance-implementation-20261001/`：`engineering-result.json` 记录类型、内容及数据库测试结果；`local-service-result.json` 核对实际健康/内容版本、真实登录、外观保存与会话恢复，并逐一比较验收前已有角色的存档。测试使用新建验收账号，不清空原有数据。

后续批次沿用同一导入、配置、风格覆盖和验收入口。其余 210 套需要先检查比例、透明边缘、关节接缝、武器分类及实际动作遮挡，再发布资源和收集配置；独立脸型、发型、头饰需要补充可分离原件与部位规则。

# ART-HE 进度

按 R0 → E1 → E2 → E3 → E4 → E5 → E6 → E7 → R9 执行。图片与源稿仅本地；不改 apps/web/src 或地图。

- [x] R0 准备与基准
- [x] E1 材料20
- [x] E2 消耗品10
- [x] E3 养成与收藏14
- [x] E4 菜单SVG8
- [x] E5 建筑标识8与角标3
- [x] E6 插画SVG30
- [x] E7 组件装饰15
- [x] R9 总览、校验、限定路径提交与接线清单

## R0 准备与自检

协作中心26339字符，低于归档阈值，已通过更新游戏协作.ps1改进行中。

- `.runtime/art-he/baseline.png`｜(1050, 1260)｜SHA256 `62a5628c89fb`
- `.runtime/art-he/baseline-svg.png`｜(1660, 160)｜SHA256 `bbbbc6e5fb62`

自检：位图板包含全部现有材料、两种合剂与常规剑T1六部位；SVG板包含7菜单及18插画，48px/24px两档。SVG闭合色面和轮廓在24px下可辨；原材料页中拓印残页保留作范围参考。

## E1 产物与自检

- `apps/web/public/art/ui-v2/items-chibi/item-material-enhance_stone.png`｜256×256｜SHA256 `88e4b985dcc5`
- `apps/web/public/art/ui-v2/items-chibi/item-material-stardust.png`｜256×256｜SHA256 `67d96f432b14`
- `apps/web/public/art/ui-v2/items-chibi/item-material-wind_herb.png`｜256×256｜SHA256 `0ab61943c028`
- `apps/web/public/art/ui-v2/items-chibi/item-material-wind_part.png`｜256×256｜SHA256 `7db981ce3882`
- `apps/web/public/art/ui-v2/items-chibi/item-material-wind_boss.png`｜256×256｜SHA256 `7aaf6acd85c0`
- `apps/web/public/art/ui-v2/items-chibi/item-material-mist_herb.png`｜256×256｜SHA256 `cd0305f37db0`
- `apps/web/public/art/ui-v2/items-chibi/item-material-mist_part.png`｜256×256｜SHA256 `ef72387c7e85`
- `apps/web/public/art/ui-v2/items-chibi/item-material-mist_boss.png`｜256×256｜SHA256 `914ac8fd1975`
- `apps/web/public/art/ui-v2/items-chibi/item-material-forge_herb.png`｜256×256｜SHA256 `76b27cdb94e6`
- `apps/web/public/art/ui-v2/items-chibi/item-material-forge_part.png`｜256×256｜SHA256 `23d3d1282b6f`
- `apps/web/public/art/ui-v2/items-chibi/item-material-forge_boss.png`｜256×256｜SHA256 `776866e676b6`
- `apps/web/public/art/ui-v2/items-chibi/item-material-frost_herb.png`｜256×256｜SHA256 `acdcbb012804`
- `apps/web/public/art/ui-v2/items-chibi/item-material-frost_part.png`｜256×256｜SHA256 `ffc4aef43ffa`
- `apps/web/public/art/ui-v2/items-chibi/item-material-frost_boss.png`｜256×256｜SHA256 `d2d792ab1637`
- `apps/web/public/art/ui-v2/items-chibi/item-material-rift_herb.png`｜256×256｜SHA256 `2d93f9444c6e`
- `apps/web/public/art/ui-v2/items-chibi/item-material-rift_part.png`｜256×256｜SHA256 `396e6c211bf4`
- `apps/web/public/art/ui-v2/items-chibi/item-material-rift_boss.png`｜256×256｜SHA256 `1e1f97a9f8de`
- `apps/web/public/art/ui-v2/items-chibi/item-material-dragon_herb.png`｜256×256｜SHA256 `019a859e7522`
- `apps/web/public/art/ui-v2/items-chibi/item-material-dragon_part.png`｜256×256｜SHA256 `e7ad0a520467`
- `apps/web/public/art/ui-v2/items-chibi/item-material-dragon_boss.png`｜256×256｜SHA256 `d8bef34beb73`
- `.runtime/art-he/E1-compare.png`｜1050×720｜SHA256 `b09952f8dace`

自检：20/20专属ID逐一登记；256×256透明、主体约80%。已与现有道具基准并排查看64px六列四行背包格，植物/部件/首领核心分类可辨，各航区形状有区别，核心金属托显著。铃兰露银紫修正后复检通过。
登记：packages/asset-manifest/ui.v2.json，仅新增20个assets键；解析器实际导入验证留到R9。

## E2 产物与自检

- `apps/web/public/art/ui-v2/items-chibi/item-resist-lightning.png`｜256×256｜SHA256 `99d77c66d8a0`
- `apps/web/public/art/ui-v2/items-chibi/item-resist-shadow.png`｜256×256｜SHA256 `71e4a535d792`
- `apps/web/public/art/ui-v2/items-chibi/item-resist-fire.png`｜256×256｜SHA256 `ecf5e7214935`
- `apps/web/public/art/ui-v2/items-chibi/item-resist-cold.png`｜256×256｜SHA256 `5f4db631cc5d`
- `apps/web/public/art/ui-v2/items-chibi/item-resist-arcane.png`｜256×256｜SHA256 `1f8b971c6b0b`
- `apps/web/public/art/ui-v2/items-chibi/item-resist-all.png`｜256×256｜SHA256 `08e17cb38053`
- `apps/web/public/art/ui-v2/items-chibi/item-resist-poison.png`｜256×256｜SHA256 `b6be65287a8d`
- `apps/web/public/art/ui-v2/items-chibi/item-food-pickup.png`｜256×256｜SHA256 `ca602525cd03`
- `apps/web/public/art/ui-v2/items-chibi/item-food-gold.png`｜256×256｜SHA256 `28cce6ba4854`
- `apps/web/public/art/ui-v2/items-chibi/item-food-material.png`｜256×256｜SHA256 `5a2293c18573`
- `.runtime/art-he/E2-compare.png`｜1050×720｜SHA256 `d0d92c501635`

自检：10/10专属ID登记；64px与两瓶原合剂并排检查通过，五种元素抗性圆瓶同系，护身剂金边方瓶、解毒剂细长瓶，三份食物与药瓶可明确区分。
两项瓶型按D-H7各修正一次并通过；source内保留v1。

## E3 产物与自检

- `apps/web/public/art/ui-v2/items-chibi/item-summon-wind.png`｜256×256｜SHA256 `306fb51be841`
- `apps/web/public/art/ui-v2/items-chibi/item-summon-forest.png`｜256×256｜SHA256 `aa4b24941b5b`
- `apps/web/public/art/ui-v2/items-chibi/item-summon-rift.png`｜256×256｜SHA256 `5cea042fa91f`
- `apps/web/public/art/ui-v2/items-chibi/item-summon-frost.png`｜256×256｜SHA256 `1c4edf726d15`
- `apps/web/public/art/ui-v2/items-chibi/item-summon-abyss.png`｜256×256｜SHA256 `c61910529a06`
- `apps/web/public/art/ui-v2/items-chibi/item-summon-dragon.png`｜256×256｜SHA256 `1ec3975675f8`
- `apps/web/public/art/ui-v2/items-chibi/item-shard-weapon.png`｜256×256｜SHA256 `c99449895ada`
- `apps/web/public/art/ui-v2/items-chibi/item-shard-close.png`｜256×256｜SHA256 `6ce0a69b2950`
- `apps/web/public/art/ui-v2/items-chibi/item-shard-elite.png`｜256×256｜SHA256 `56329ce7c439`
- `apps/web/public/art/ui-v2/items-chibi/item-shard-blank.png`｜256×256｜SHA256 `4d73dd5e3827`
- `apps/web/public/art/ui-v2/items-chibi/item-rep-forge.png`｜256×256｜SHA256 `a08ab3d67d67`
- `apps/web/public/art/ui-v2/items-chibi/item-rep-dock.png`｜256×256｜SHA256 `9d9f4e3b6526`
- `apps/web/public/art/ui-v2/items-chibi/item-rep-post.png`｜256×256｜SHA256 `d6de0c3c495a`
- `apps/web/public/art/ui-v2/items-chibi/item-star-tide-power.png`｜256×256｜SHA256 `9ea3646a0ba8`
- `.runtime/art-he/E3-compare.png`｜1050×720｜SHA256 `b22582ca540c`

自检：14/14专属ID登记；召唤石wind/forest/rift/frost/abyss/dragon与deep-progression.json一致。已与基准并排检查64px背包格：六石同系、内部风/叶/巨像/冠/星/龙互异；残页纸型一致，三徽记和瓶装星潮可辨。
E3需要Claude接入进度页，未改前端。

## E4 产物与自检

- `packages/asset-manifest/ui-illustrations.v1.json`｜—×—｜SHA256 `1d8cd59a1a9e`
- `.runtime/art-he/E4-compare.png`｜1450×190｜SHA256 `e30d777d47fc`

自检：8/8菜单字形，已与现有7个菜单同排检查48px/24px，色面、墨线及纸/皮革/钢材Token一致；日历/信板/脚手架/航图/木箱/奖章卷宗/爪印书/六角星门均可区分。

| 菜单键 | viewBox | 标记SHA256前12位 |
|---|---|---|
| today | 50×52 | 2542081c75eb |
| commission | 50×52 | 20274215a47b |
| port-build | 50×52 | 2ff87554c2e7 |
| chart | 50×52 | 374d65d49e27 |
| warehouse | 50×52 | 27a320fdc7a5 |
| archive | 50×52 | 5535526f1a15 |
| pets | 50×52 | 4176e79e76e8 |
| stargate | 50×52 | bae84e7784fe |


## E5 产物与自检

- `apps/web/public/art/hub-ui/port-marks.png`｜924×264｜SHA256 `7694dec52ccd`
- `apps/web/public/art/hub-ui/port-marks.json`｜—×—｜SHA256 `86a3b682fc41`
- `.runtime/art-he/E5-compare.png`｜1100×570｜SHA256 `4d87942db199`
- `.runtime/art-he/E5-buildings.png`｜1050×345｜SHA256 `b61a895f77e3`

自检：8标识+3角标齐全，透明128px/64px，已与位图基准和现有建筑并排检查；32/48px图案能区分、标识不盖住主体。星门留有下述几何差异。

帧：

| 帧名 | 源尺寸 | SHA256前12位 |
|---|---|---|
| hub-mark-stargate | 128×128 | 250fb6f7d039 |
| hub-mark-hall | 128×128 | 7a2a66eaf723 |
| hub-mark-forge | 128×128 | 579edc669f21 |
| hub-mark-pier | 128×128 | 5b842a49aa16 |
| hub-mark-post | 128×128 | 991c7023ee8f |
| hub-mark-warehouse | 128×128 | 2cd9bdf6dc98 |
| hub-mark-wardrobe | 128×128 | cd74c9d6c655 |
| hub-mark-pet-yard | 128×128 | 66714bced490 |
| hub-badge-new | 64×64 | 0c2b56fb3902 |
| hub-badge-ready | 64×64 | 347333687681 |
| hub-badge-done | 64×64 | cf143bf6260e |

标识锚点[0.5,1]，建议32/48px；角标[0.5,0.5]，建议12–16px。图集2px内边距、不旋转、不裁切。

保留差异（D-H7）：hub-mark-stargate修正一次后为平顶但仍含两条短竖边，非严格六边；32px可辨星门，建议后续精修。E4 stargate为严格六边。


## E6 产物与自检

- `packages/asset-manifest/ui-illustrations.v1.json`｜—×—｜SHA256 `1d8cd59a1a9e`
- `.runtime/art-he/E6-compare.png`｜1168×670｜SHA256 `cfab0669767f`

自检：30/30系统/元素伤害/属性插画，48px/24px与18基准同排检查通过，闭合色面和深墨描边一致；8个属性各有独立图形，未改纯功能符号。

| 图标键 | viewBox | 标记SHA256前12位 |
|---|---|---|
| chest | 32×32 | 39fa6a356bcb |
| skull | 32×32 | fe01c2bfb7a4 |
| book | 32×32 | 5fb91927dd74 |
| compass | 32×32 | c87f065e933d |
| house | 32×32 | 2c753fb44ee9 |
| warehouse | 32×32 | 2c7426551ba3 |
| hammer | 32×32 | 42b52872c33f |
| salvage | 32×32 | caf40ade2165 |
| people | 32×32 | 57cf0459cec2 |
| auto | 32×32 | a3dc0a312ca7 |
| clock | 32×32 | 112981dd22f0 |
| star | 32×32 | aadeb804817a |
| refresh | 32×32 | 3e894199c8b5 |
| link | 32×32 | 71b648729004 |
| cold | 32×32 | 98fd50bd80de |
| lightning | 32×32 | 6188c6895abe |
| arcane | 32×32 | 9636361c3ea5 |
| poison | 32×32 | f33557e13e41 |
| bleed | 32×32 | 858ac12acc4d |
| physical | 32×32 | 644259deb3e2 |
| projectiles | 32×32 | c8a356ea9112 |
| area | 32×32 | 3b92c7e9fd01 |
| blockChance | 32×32 | bcc71befd299 |
| thorns | 32×32 | f5e7e0ea9106 |
| healingReceived | 32×32 | 80fcf9943394 |
| castSpeed | 32×32 | fa35d4b863d2 |
| statusDuration | 32×32 | 1c29679ad7f1 |
| executeBonus | 32×32 | 9eb2f0253d38 |
| vsElite | 32×32 | a17666fe497a |
| vsBoss | 32×32 | dddca8bb6197 |

元素映射：cold → --color-combat-element-cold；lightning → --color-combat-element-lightning；arcane/area → --color-combat-element-arcane；poison → --color-combat-element-poison；bleed → --color-danger；physical/projectiles → --color-icon-steel/steel-light。
建议新增 Token（未改tokens.json）：专用 bleed/physical/projectiles/area 语义色，如未来需要独立调色。


## E7 产物与自检

- `apps/web/public/art/hub-ui/ui-ornaments.png`｜924×332｜SHA256 `6e9988a1fe06`
- `apps/web/public/art/hub-ui/ui-ornaments.json`｜—×—｜SHA256 `87f03bb9bf17`
- `.runtime/art-he/E7-compare.png`｜1100×760｜SHA256 `af5034bc49d0`
- `.runtime/art-he/slot-shine-preview.gif`｜—×—｜SHA256 `20e6e7052d6f`

自检：4品质框+6流光+3面板装饰+2提示装饰齐全，已与基准并排检查；奶白示例面板、横长/竖长九宫格均无明显角部拉伸，中央透明，标题中间留空，分隔线两端像素相同。

| 帧名 | 源尺寸 | 九宫格切片(top/right/bottom/left) | SHA256前12位 |
|---|---|---|---|
| slot-frame-common | 128×128 | [24, 24, 24, 24] | d12fce0bbebc |
| slot-frame-magic | 128×128 | [24, 24, 24, 24] | 2e1473bcc346 |
| slot-frame-rare | 128×128 | [24, 24, 24, 24] | 8c8df7ca5c46 |
| slot-frame-legendary | 128×128 | [24, 24, 24, 24] | 306944ae288e |
| slot-shine-0 | 128×128 | 不切片 | 73423091c9e7 |
| slot-shine-1 | 128×128 | 不切片 | c22397191c42 |
| slot-shine-2 | 128×128 | 不切片 | 3a761cb19db6 |
| slot-shine-3 | 128×128 | 不切片 | 74330afb1319 |
| slot-shine-4 | 128×128 | 不切片 | 118e4a27a012 |
| slot-shine-5 | 128×128 | 不切片 | 4c018067ecbd |
| panel-crest | 480×64 | 不切片 | 1b3958ff1f5b |
| panel-divider | 512×16 | 不切片 | e42cd51f02af |
| panel-corner | 64×64 | 不切片 | 797bfd37b30c |
| tip-arrow | 32×16 | 不切片 | 5fb3d3f9cb34 |
| toast-bg | 256×64 | [20, 20, 20, 20] | 689b9c291e00 |

品质框建议64×64；流光同画布叠加、0→5顺序6fps循环，减少动态时关闭；标题花饰240×32（需要时可用源尺寸）、分隔线256×8 repeat-x、角花32×32并旋转、尖角16×8、提示底128×32起按九宫格伸展。所有切片值均为源像素。


## R9 校验与交付

- 总览 `.runtime/art-he/overview.png`｜1500×2100｜SHA256 `1bdded6d2b1a`；已查看，包含44道具模拟背包格、E4/E6与原SVG同排、E5建筑叠图、E7示例面板。
- `npx tsc --noEmit -p .`：通过（exit 0），`.runtime/art-he/tsc.log`。
- `pnpm config:check`：通过，10本工作簿一致，`.runtime/art-he/config-check.log`。
- `npx tsx tools/validate-content.ts`：通过（ok:true），`.runtime/art-he/validate-content.log`。
- 由 `rg -l asset-manifest tests -g *.test.ts` 找到16个测试文件；`npx vitest run <16 files> --maxWorkers=1 --no-file-parallelism`：83/83通过，含plane-scenes，`.runtime/art-he/manifest-tests.log`。
- `npx tsx .runtime/art-he/verify-resolvers.ts`：导入真实 crafting-model.ts、bag-model.ts、ui-assets.ts，20/20材料、10/10消耗品专属图命中、回退0，`.runtime/art-he/resolver-verification.json`。
- `python .runtime/art-he/technical-validation.py`：通过；44道具、38字形、26图集帧；RGBA+sRGB ICC、透明RGB归零、atlas<=2048、2px内边距、不旋转/不裁切、帧像素一致、Token全存在、旧条目完整保留。运行时共 2406753 bytes（约2.41MB），低于12MB。
- 最新共享HEAD清单合并记录：`.runtime/art-he/merge-latest.json`；仅新增ui.v2的44条、hub-ui的2条及SVG清单，不覆盖ART-HC元数据或条目。
- 图片、源稿、生成提示、对比图、导出脚本仅留 `.runtime/art-he/` 与 `apps/web/public/art/`，均不提交。
- 本批按限制未运行游戏、无头浏览器或浏览器自动化；自动生效结论来自真实模块导入和资源路径存在性，不冒充实机验收。
- 限定路径提交：`07acae6a`，仅5个文本文件（3份清单JSON、进度和决策）；`git show --stat`确认没有图片/源素材。
- 协作中心完成时26397字符，无需归档；已仅通过更新游戏协作.ps1改为「待接线」并在「双方留言」写入指定一行。
- [x] E1–E7全部到位并登记，技术与内容校验通过；E1/E2真实模块导入自动解析通过。
- [x] 各项基准并排自检及本地总览已完成；D-H7保留差异如实记录。
- [x] 接线清单完整；提交无图片；协作状态「待接线」。

### 自检保留差异

- `hub-mark-stargate`：D-H7修正一次后平顶，但石环仍有两条短竖边（近八边），32/48px入口含义可辨；建议后续精修为严格六边。E4的stargate SVG已为严格六边。
- E7仅提供可选装饰，不替换任何Token CSS控件；是否接入由Claude决定。

## 接线清单

### E1 / E2：已自动生效（解析器验证）

统一：PNG 256×256，中心锚点[0.5,0.5]，建议背包56px/64px格，地面如需用32px。`ui.v2.json` → 现有 art/hasArt 解析器；下面全部实测无回退。

| 内容ID | 解析到资源ID | 运行时路径 | 验证 |
|---|---|---|---|
| enhance_stone | item-material-enhance_stone | /art/ui-v2/items-chibi/item-material-enhance_stone.png | 专属图命中，无借用 |
| stardust | item-material-stardust | /art/ui-v2/items-chibi/item-material-stardust.png | 专属图命中，无借用 |
| wind_herb | item-material-wind_herb | /art/ui-v2/items-chibi/item-material-wind_herb.png | 专属图命中，无借用 |
| wind_part | item-material-wind_part | /art/ui-v2/items-chibi/item-material-wind_part.png | 专属图命中，无借用 |
| wind_boss | item-material-wind_boss | /art/ui-v2/items-chibi/item-material-wind_boss.png | 专属图命中，无借用 |
| mist_herb | item-material-mist_herb | /art/ui-v2/items-chibi/item-material-mist_herb.png | 专属图命中，无借用 |
| mist_part | item-material-mist_part | /art/ui-v2/items-chibi/item-material-mist_part.png | 专属图命中，无借用 |
| mist_boss | item-material-mist_boss | /art/ui-v2/items-chibi/item-material-mist_boss.png | 专属图命中，无借用 |
| forge_herb | item-material-forge_herb | /art/ui-v2/items-chibi/item-material-forge_herb.png | 专属图命中，无借用 |
| forge_part | item-material-forge_part | /art/ui-v2/items-chibi/item-material-forge_part.png | 专属图命中，无借用 |
| forge_boss | item-material-forge_boss | /art/ui-v2/items-chibi/item-material-forge_boss.png | 专属图命中，无借用 |
| frost_herb | item-material-frost_herb | /art/ui-v2/items-chibi/item-material-frost_herb.png | 专属图命中，无借用 |
| frost_part | item-material-frost_part | /art/ui-v2/items-chibi/item-material-frost_part.png | 专属图命中，无借用 |
| frost_boss | item-material-frost_boss | /art/ui-v2/items-chibi/item-material-frost_boss.png | 专属图命中，无借用 |
| rift_herb | item-material-rift_herb | /art/ui-v2/items-chibi/item-material-rift_herb.png | 专属图命中，无借用 |
| rift_part | item-material-rift_part | /art/ui-v2/items-chibi/item-material-rift_part.png | 专属图命中，无借用 |
| rift_boss | item-material-rift_boss | /art/ui-v2/items-chibi/item-material-rift_boss.png | 专属图命中，无借用 |
| dragon_herb | item-material-dragon_herb | /art/ui-v2/items-chibi/item-material-dragon_herb.png | 专属图命中，无借用 |
| dragon_part | item-material-dragon_part | /art/ui-v2/items-chibi/item-material-dragon_part.png | 专属图命中，无借用 |
| dragon_boss | item-material-dragon_boss | /art/ui-v2/items-chibi/item-material-dragon_boss.png | 专属图命中，无借用 |
| resist_lightning | item-resist-lightning | /art/ui-v2/items-chibi/item-resist-lightning.png | 专属图命中，无借用 |
| resist_shadow | item-resist-shadow | /art/ui-v2/items-chibi/item-resist-shadow.png | 专属图命中，无借用 |
| resist_fire | item-resist-fire | /art/ui-v2/items-chibi/item-resist-fire.png | 专属图命中，无借用 |
| resist_cold | item-resist-cold | /art/ui-v2/items-chibi/item-resist-cold.png | 专属图命中，无借用 |
| resist_arcane | item-resist-arcane | /art/ui-v2/items-chibi/item-resist-arcane.png | 专属图命中，无借用 |
| resist_all | item-resist-all | /art/ui-v2/items-chibi/item-resist-all.png | 专属图命中，无借用 |
| resist_poison | item-resist-poison | /art/ui-v2/items-chibi/item-resist-poison.png | 专属图命中，无借用 |
| food_pickup | item-food-pickup | /art/ui-v2/items-chibi/item-food-pickup.png | 专属图命中，无借用 |
| food_gold | item-food-gold | /art/ui-v2/items-chibi/item-food-gold.png | 专属图命中，无借用 |
| food_material | item-food-material | /art/ui-v2/items-chibi/item-food-material.png | 专属图命中，无借用 |

### E3：进度页召唤石 / 残页 / 声望

统一：ui.v2.json中的单图，256×256；锚点[0.5,0.5]，建议48/64px；无帧、无占地偏移。

| 资源ID | 运行时路径 | 接到哪里 |
|---|---|---|
| item-summon-wind | /art/ui-v2/items-chibi/item-summon-wind.png | 进度页召唤石 summons.wind |
| item-summon-forest | /art/ui-v2/items-chibi/item-summon-forest.png | 进度页召唤石 summons.forest |
| item-summon-rift | /art/ui-v2/items-chibi/item-summon-rift.png | 进度页召唤石 summons.rift |
| item-summon-frost | /art/ui-v2/items-chibi/item-summon-frost.png | 进度页召唤石 summons.frost |
| item-summon-abyss | /art/ui-v2/items-chibi/item-summon-abyss.png | 进度页召唤石 summons.abyss |
| item-summon-dragon | /art/ui-v2/items-chibi/item-summon-dragon.png | 进度页召唤石 summons.dragon |
| item-shard-weapon | /art/ui-v2/items-chibi/item-shard-weapon.png | 星门收藏残页；blank留中心叠图 |
| item-shard-close | /art/ui-v2/items-chibi/item-shard-close.png | 星门收藏残页；blank留中心叠图 |
| item-shard-elite | /art/ui-v2/items-chibi/item-shard-elite.png | 星门收藏残页；blank留中心叠图 |
| item-shard-blank | /art/ui-v2/items-chibi/item-shard-blank.png | 星门收藏残页；blank留中心叠图 |
| item-rep-forge | /art/ui-v2/items-chibi/item-rep-forge.png | 港口建设声望 forge |
| item-rep-dock | /art/ui-v2/items-chibi/item-rep-dock.png | 港口建设声望 dock |
| item-rep-post | /art/ui-v2/items-chibi/item-rep-post.png | 港口建设声望 post |
| item-star-tide-power | /art/ui-v2/items-chibi/item-star-tide-power.png | 进度页星潮之力 |

### E4：hud-icons.ts 菜单

清单 `packages/asset-manifest/ui-illustrations.v1.json` 的 menu；viewBox 0 0 50 52，沿用外层stroke-width=2、round cap/join、stroke var(--color-chrome-ink)；建议48px，24px已验。不带外层svg、不带文字、不定义新Token。

| 键（menu.<name>） | 接到哪里 |
|---|---|
| today | hudMenuIcon → 今日入口 |
| commission | hudMenuIcon → 委托入口 |
| port-build | hudMenuIcon → 港口建设入口 |
| chart | hudMenuIcon → 航图入口 |
| warehouse | hudMenuIcon → 仓库入口 |
| archive | hudMenuIcon → 档案/成就入口 |
| pets | hudMenuIcon → 宠物图鉴入口 |
| stargate | hudMenuIcon → 星门入口 |

### E5：港口建筑头顶

TexturePacker hash：`/art/hub-ui/port-marks.json` + `/art/hub-ui/port-marks.png`；登记hub-ui.v1.json的port-marks。圆牌尖角定位到建筑顶中心上方8px为建议，实际建筑挂点由Claude确定，不改地图。

| 资源/帧名 | 源尺寸 | 锚点 | 建议显示 | 接到哪里 |
|---|---|---|---|---|
| hub-mark-stargate | 128×128 | [0.5, 1] | 32/48px | 建筑 stargate |
| hub-mark-hall | 128×128 | [0.5, 1] | 32/48px | 建筑 hall |
| hub-mark-forge | 128×128 | [0.5, 1] | 32/48px | 建筑 forge |
| hub-mark-pier | 128×128 | [0.5, 1] | 32/48px | 建筑 pier |
| hub-mark-post | 128×128 | [0.5, 1] | 32/48px | 建筑 post |
| hub-mark-warehouse | 128×128 | [0.5, 1] | 32/48px | 建筑 warehouse |
| hub-mark-wardrobe | 128×128 | [0.5, 1] | 32/48px | 建筑 wardrobe |
| hub-mark-pet-yard | 128×128 | [0.5, 1] | 32/48px | 建筑 pet-yard |
| hub-badge-new | 64×64 | [0.5, 0.5] | 12–16px，右上叠加 | 可领/新开放 |
| hub-badge-ready | 64×64 | [0.5, 0.5] | 12–16px，右上叠加 | 收益可领 |
| hub-badge-done | 64×64 | [0.5, 0.5] | 12–16px，右上叠加 | 已完成 |

### E6：ui/icons.ts illustrations

清单 `packages/asset-manifest/ui-illustrations.v1.json` 的 icons；viewBox 0 0 32 32，外层fill=none、stroke var(--color-chrome-ink)、stroke-width=2、round cap/join，建议20/24/32px（24/48px已验）。属性名接线时应让新illustrations优先于现有aliases，否则仍会被旧别名覆盖。

| 键（icons.<name>） | 接到哪里 |
|---|---|
| chest | ui/icons.ts illustrations.chest |
| skull | ui/icons.ts illustrations.skull |
| book | ui/icons.ts illustrations.book |
| compass | ui/icons.ts illustrations.compass |
| house | ui/icons.ts illustrations.house |
| warehouse | ui/icons.ts illustrations.warehouse |
| hammer | ui/icons.ts illustrations.hammer |
| salvage | ui/icons.ts illustrations.salvage |
| people | ui/icons.ts illustrations.people |
| auto | ui/icons.ts illustrations.auto |
| clock | ui/icons.ts illustrations.clock |
| star | ui/icons.ts illustrations.star |
| refresh | ui/icons.ts illustrations.refresh |
| link | ui/icons.ts illustrations.link |
| cold | ui/icons.ts illustrations.cold |
| lightning | ui/icons.ts illustrations.lightning |
| arcane | ui/icons.ts illustrations.arcane |
| poison | ui/icons.ts illustrations.poison |
| bleed | ui/icons.ts illustrations.bleed |
| physical | ui/icons.ts illustrations.physical |
| projectiles | ui/icons.ts illustrations.projectiles |
| area | ui/icons.ts illustrations.area |
| blockChance | ui/icons.ts illustrations.blockChance |
| thorns | ui/icons.ts illustrations.thorns |
| healingReceived | ui/icons.ts illustrations.healingReceived |
| castSpeed | ui/icons.ts illustrations.castSpeed |
| statusDuration | ui/icons.ts illustrations.statusDuration |
| executeBonus | ui/icons.ts illustrations.executeBonus |
| vsElite | ui/icons.ts illustrations.vsElite |
| vsBoss | ui/icons.ts illustrations.vsBoss |

### E7：组件装饰（由Claude决定）

TexturePacker hash：`/art/hub-ui/ui-ornaments.json` + `/art/hub-ui/ui-ornaments.png`；登记hub-ui.v1.json的ui-ornaments。均为可选覆盖层；源像素切片，不能把贴图装饰当控件本体。

| 帧名 | 源尺寸 | 九宫格 | 锚点/建议显示 | 接到哪里 |
|---|---|---|---|---|
| slot-frame-common | 128×128 | [24, 24, 24, 24] | [0.5,0.5] / [64.0, 64.0] | 物品品质边框 |
| slot-frame-magic | 128×128 | [24, 24, 24, 24] | [0.5,0.5] / [64.0, 64.0] | 物品品质边框 |
| slot-frame-rare | 128×128 | [24, 24, 24, 24] | [0.5,0.5] / [64.0, 64.0] | 物品品质边框 |
| slot-frame-legendary | 128×128 | [24, 24, 24, 24] | [0.5,0.5] / [64.0, 64.0] | 物品品质边框 |
| slot-shine-0 | 128×128 | 不切片 | [0.5,0.5] / [64.0, 64.0] | 传奇框叠层，0→5，6fps循环，减少动态关闭 |
| slot-shine-1 | 128×128 | 不切片 | [0.5,0.5] / [64.0, 64.0] | 传奇框叠层，0→5，6fps循环，减少动态关闭 |
| slot-shine-2 | 128×128 | 不切片 | [0.5,0.5] / [64.0, 64.0] | 传奇框叠层，0→5，6fps循环，减少动态关闭 |
| slot-shine-3 | 128×128 | 不切片 | [0.5,0.5] / [64.0, 64.0] | 传奇框叠层，0→5，6fps循环，减少动态关闭 |
| slot-shine-4 | 128×128 | 不切片 | [0.5,0.5] / [64.0, 64.0] | 传奇框叠层，0→5，6fps循环，减少动态关闭 |
| slot-shine-5 | 128×128 | 不切片 | [0.5,0.5] / [64.0, 64.0] | 传奇框叠层，0→5，6fps循环，减少动态关闭 |
| panel-crest | 480×64 | 不切片 | [0.5,0.5] / [240.0, 32.0] | 面板标题两侧，中间透明 |
| panel-divider | 512×16 | 不切片 | [0.5,0.5] / [256.0, 8.0] | 分隔线repeat-x |
| panel-corner | 64×64 | 不切片 | [0.5,0.5] / [32.0, 32.0] | 四角旋转0/90/180/270度 |
| tip-arrow | 32×16 | 不切片 | [0.5,0.5] / [16.0, 8.0] | tooltip尖角，顶边与背景衔接 |
| toast-bg | 256×64 | [20, 20, 20, 20] | [0.5,0.5] / [128.0, 32.0] | 提示条底 |

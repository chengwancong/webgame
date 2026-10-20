# PA6 SP33 原生宠物工具

从 open-world 根目录执行。依赖项目已有的 Node、sharp、playwright、typescript 和本机 Chrome。只使用有界面 Chrome / ANGLE D3D11；同一时间只运行一个导出、打包或验收命令。不得改库贴图、骨骼或时间轴。

唯一生产配置是 families.json 的 families 数组（18项）。每项包含稳定 idPrefix、原库 dir/base、生物/家族、动作映射、隐藏正则、保留本体光层、slot+offset挂点、三阶尺寸、nativeFacing、物理帧格。regression 是禁用生物 julongzisi 的本地工具回归例外，不进入生产数组、不写入正式v3。

## 单族重跑

修改该族配置后，依次运行：

```powershell
node tools/pets/sp33/run-export.mjs wind-free
node tools/pets/sp33/pack.mjs wind-free
node tools/pets/sp33/update-skins.mjs
node tools/pets/sp33/build-preview.mjs
node tools/pets/sp33/attachments.mjs
# 仅面积超限时执行，保持图片/类型/特效不变，只适配显示比例
node tools/pets/sp33/fit-attachments.mjs
node tools/pets/sp33/attachments.mjs
node tools/pets/sp33/evidence.mjs
node tools/pets/sp33/validate.mjs
node tools/pets/sp33/audit.mjs
node tools/pets/sp33/finalize.mjs
```

不传族参数时 run-export、pack 顺序遍历18族。不要并行启动两个命令。完整原生帧/导出JSON在 .design/pet-sp33-rollout/exports/，备份也在该目录；init.mjs 只在备份不存在时创建备份。不要在已完成任务上无故重跑 init（会追加批次开始日志）。

## 原生与数据约定

- SkeletonBinary.ts 从 tools/vendor/spine36/ 在内存中转译，不产生需入库的构建文件。保留原许可证注释。TextureAtlas 查找只对原库个别尾随空格的区域名做读取容错，源文件不修改。
- 24fps，循环 round(duration*24)，非循环 floor(duration*24)+1；取原时间，不合成姿态。只隐藏配置指定插槽，原生本体发光保留。
- 根骨为地面。全动作同一缩放，Idle0包围盒为尺寸基准。原生离地距离保留。
- 每族一份共享 actor.webp / actor.json / regions.webp / materials.bin / sockets.json，三形态目录只存 profile.json；两份manifest都指向共享文件。
- RG16索引放在R/G，B为覆盖alpha，A固定255；每个6字节码字的首字节255表示原色直出，9套皮肤palette不改底图。仅在颜色数超65535时逐级shift，记录最大误差。
- 192物理格仍使用256逻辑坐标：四边虚拟补32px，裁边后没有存储这些透明像素。anchor、spriteSourceSize和sockets一起平移32px，referencePixelHeight仍按192实际渲染测量。无需修改composer.js。
- 挂件沿用原PNG、身份、层级、anchor与特效参数。只更新family、定位offset及为15%面积约束所需的displaySize。attachmentOffsets可覆盖特殊生物的徽记定位；没有尾的元素在后下缘挂尾饰。
- index-optimization 是无损索引排列优化，仅采用更小的结果；不改RGB/alpha、色板或shift。

## 验收

使用外层 .claude/launch.json 中已有 web-public-static 配置：Python只读静态根目录 open-world/apps/web/public，127.0.0.1:8626。不要碰8612/8790。

访问 http://127.0.0.1:8626/art/starsea/pets/v3/preview/index.html 。validate.mjs 在这个URL运行原 pa4.validate()。composer.js 保持逐字节一致；pa6-qa.js 只添加制作验收工具和证据图。

audit.mjs 检查全部原生采样帧、码本还原、共享引用、尺寸、源SHA、皮肤身份、原挂件/特效资源不变。所有截图/帧/明细都只留本地 .design/pet-sp33-rollout/（有gitignore）。进度、决策和最终数字写 docs/pets/pa6-progress.md。禁止git commit原始截图、帧或构建产物。

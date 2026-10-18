# PA1 进度

状态：全部模型资源制作与本组自检完成。日期：2026-10-17（Asia/Shanghai）。

- [x] ① 17 家族 × 五阶原生 idle 首帧拼装总表，85/85。
- [x] ② 六岛六家族已确定；17 家族选/不选理由在 decisions.md 与 report.md。
- [x] ③ 风栖三成长 + 两变体先完成图集与可视样板检查。
- [x] ④ 其余五只三形态，成长总数 18/18。
- [x] ⑤ 十二个 b/d 外观，12/12。
- [x] ⑥ 30 套、3805 帧、149 段动作自检；并排预览、镜像、真实连续播放与截图齐全。
- [x] ⑦ report.md 完成，包含阶段/动作表、缺项、来源、边界、复现命令和限制。

最终：manifest.json 的 30 条 type=pet，status=producer-reviewed。C8d 缺 knock、全体无 skill，按默认裁定记“无”。出场/收回/抚摸为“程序演出，待做”；连携动作留给 Claude。

范围：只写宠物两个目录，未触碰正式服务、公共 manifest、玩法/版本/数据库，未 git commit。evidence/ 仅本地。

复核入口：report.md；复现入口：export.mjs、calibrate.mjs、locomotion-check.mjs、preview-check.mjs、complete.mjs。可视预览：node assets/starsea/pets/serve-preview.mjs。

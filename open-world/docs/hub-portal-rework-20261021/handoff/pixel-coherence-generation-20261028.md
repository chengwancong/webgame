# 细腻像素稿生产说明 · 2026-10-28

内置 image_gen 只生成草稿：原创柴犬细节稿、八职业 NPC、九件港口地物。原 PNG、网格稿、完整提示词与工具返回明细只留本地，不提交 Git；完整记录在 `.runtime/pixel-coherence/raw-generation-prompts-20261028.md`，三份输入稿 SHA256 在公开 `art-pixel/coherence-production.json`。

柴犬由本机 proper-pixel-art 以实际细网格恢复，再制作原生96px身体；NPC逐格恢复，不把整张图当精灵。统一64色和二值透明，清理断裂小片与轮廓；`fine-continuous-skins.mjs` 在原主角Spine骨架上绑定连续加权表面，再由 `coherence-fine-heroes.mjs` / `coherence-fine-npcs.mjs` 保持原时钟烘焙。`coherence-draft.py` 处理九件地物；后续环境v2纠正旧通用映射，实际资源定义优先于旧recipe。

正式候选先过 `check-pixel-art.mjs`，再核对原生素材和实际动作联系表。中间刚性切片导致的断肢、偏写实的碎纹理、裁切树冠及武器错配均被退回。技术覆盖和图片校验不等同真机视觉验收；最终状态与复现入口见 [整屏纠偏](pixel-coherence-20261027.md)。

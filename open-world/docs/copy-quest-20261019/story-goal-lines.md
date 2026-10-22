# 旧章节（homeward）任务目标文案差量（P42，Claude 2026-10-21）

问题：config/json/tasks.json 的 story-meadow…story-dragonbone 六条 `goal` 全是“完成救援并突破首领结界”，任务页六章目标无差别（story-campaign.ts 仍在用，app.ts:89）。
改法：只改任务工作簿 `goal` 列，不改 id/奖励/条件/对白。

| 任务 id | 新 goal |
|---|---|
| story-meadow | 找到被困的远行队，击破草原结界首领 |
| story-forest | 追查被篡改的路标，击破林中结界首领 |
| story-rift | 重燃熄灭的炉火，击破守炉的结界首领 |
| story-tundra | 循着冰下的求救声，击破冰原结界首领 |
| story-abyss | 找回没有归来的人，击破深渊结界首领 |
| story-dragonbone | 打通最后一条归途，击破龙骨结界首领 |

验收：任务页六章目标互不相同；其余字段、导出 JSON 校验（config:check）不变。

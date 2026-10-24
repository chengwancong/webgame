# M04 CONTENT-G01 功能细则

依据：../modules/M04-run-growth.md，10-22 引导降级与10-23 M17新决定优先于旧段落。

## 规则

寻宝复用 all 标签的银/金池，不新增未验证增益；再来一次保留上一场残页组合并重新扣除。

## 边界

现有银/金通用池足够生成三张不同候选；候选仍须过套装/效果前置。残页不足或满包时拒绝再来一次。

## 数据与界面字段

augments.options/chosen、retry.allowed/reason、入场残页快照。

## 验收标准

三候选无重复且不出棱彩；同命令重发不重复扣残页；离场清除局内增益。

## 给 Claude 的前端清单

按上述真实字段展示状态；本文件为接线和验收要求，未声称界面已实现。未知或未定价的内容保持明确不可领取，不能用占位奖励冒充已发。

## 原待定项逐项覆盖

- 寻宝只出银 / 金、偏移动与拾取类，现有 90 个里这类增益够不够。默认：先用通用类（all），不够在 M14 校对时补 2–3 张，不砍掉寻宝的选择（fill-gaps-not-hide）。
- 「再来一次」是否保留上一场的残页组合（自动扣新残页）。默认：保留组合，自动扣，残页不够时提示。

当前可用通用银/金候选：aug-s-atk、aug-s-crit、aug-s-critdmg、aug-s-cast、aug-s-area、aug-s-status、aug-s-duration、aug-s-cdr、aug-s-speed、aug-s-hp、aug-s-armor、aug-s-leech、aug-s-elite、aug-s-boss、aug-s-mana、aug-s-dr、aug-s-poison、aug-s-bleed、aug-s-opening、aug-s-edge、aug-s-aftershock、aug-s-battle-will、aug-s-energy、aug-s-refund、aug-s-bulwark、aug-s-thorns、aug-s-drinking、aug-s-tailwind、aug-s-suppress、aug-s-fire-path、aug-s-thunder、aug-s-bloodthirst、aug-g-wildfire、aug-g-shatter、aug-g-overload、aug-g-poison-burst、aug-g-blade-dance、aug-g-return、aug-g-time-return、aug-g-time-sand、aug-g-bone、aug-g-evasion、aug-g-whirl-edge。数量足够，不额外添卡；移动专项有疾风砧，不能声称已有独立拾取范围机制。

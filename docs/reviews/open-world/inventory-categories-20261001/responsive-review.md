# 背包响应式只读复核

日期：2026-10-01。依据：根目录 `项目.md` 的 V2 视觉标准、响应式要求及“状态切换与布局稳定”。使用独立临时 PostgreSQL、API 和 Vite，未操作 8612 用户角色或修改产品代码。新建测试角色后仅执行分类、选择、搜索控件与滚动等只读 UI 操作。

## 结果

| 分辨率 | 分类区域 | 图标选择前后 | 焦点与列表滚动 | 窗口及操作区 |
| --- | --- | --- | --- | --- |
| 1024×576 | 五类边界完全固定 | 图标、槽位和卡片尺寸固定 | 焦点保留；24 件装备列表实际滚动后选择不跳动 | 通过 |
| 1600×900 | 五类边界完全固定 | 同上 | 焦点保留；实际滚动后选择不跳动 | 通过 |
| 1920×1080 | 五类边界完全固定 | 同上 | 焦点保留；24 件装备全部可见，本视口无需滚动 | 通过 |
| 1280×720 | 五类边界完全固定 | 同上 | 焦点保留 | 通过，另存最终展示图 |
| 375×812 | 修复后五类边界完全固定 | 同上 | 焦点保留；详情及操作通过主内容内部滚动可达 | 通过 |

无浏览器页面错误和横向溢出。后续复核前后测试角色数据库状态深比较一致；临时数据库与测试服务均已清理。详情截图等待主属性及报价读取完成。

## 已发现并复核的修复

初次 375×812 检查发现搜索框覆盖第一排分类按钮，真实点击被输入框拦截，见 `responsive-failure.png`。主 Agent 将窄屏网格首尾行从 `auto` 改为 `max-content` 并设置 `align-content:start` 后，重新使用真实点击遍历五种分类通过。初次 `responsive-result.json` 保留故障现场；修复后的结果以 `responsive-followup-result.json` 为准。

窄屏采用固定 330px 列表区。合剂只有一排时，滚动到详情底部会看到这一区域剩余空白；属于维持分类布局一致的折中，不是内容丢失或遮挡。材料与合剂操作区边界均为 x=34..341、y=625.5..705，处于窗口 x=8..367、y=16..796 内。

## 截图证据

- `responsive-1280x720-all-attack-tonic.png`：最终展示图，全部分类，选中攻击合剂，真实持有数量及生效状态。
- `responsive-1280x720-equipment.png`：基准装备详情，报价已加载。
- `responsive-1024x576-equipment.png`、`responsive-1024x576-equipment-scrolled-selected.png`：低高度装备网格与滚动选择；第二张保留同期 Tips 交互现场，随后主分支已另行修复选中后 Tips 收起。
- `responsive-1024x576-materials.png`、`responsive-1024x576-consumables.png`：材料与合剂专属详情和操作。
- `responsive-1600x900-equipment.png`、`responsive-1920x1080-equipment.png`：大分辨率边界与装备网格。
- `responsive-375x812-equipment.png`、`responsive-375x812-materials.png`：修复后的分类、筛选、网格与详情纵向排列。
- `responsive-375x812-materials-actions.png`、`responsive-375x812-consumable-actions.png`：滚动后的操作区完整可达。

本复核不重复主 Agent 的消费、回执及实际装备操作验收。

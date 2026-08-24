# 机构端 V1.1 页面还原 Design QA

## 审查范围

- 参考：`V1.1_APPROVED` 的 10 张机构端核心截图、`institution.html`、视觉/交互/时间与图标规范。
- 实现：七大栏目、公共 Shell、Page Tabs、Drawer、Popover、Workspace 和全局搜索。
- 尺寸：1600×1000、1440×900、1280×800。
- 证据：`artifacts/institution-v1.1-seven-domain-restoration/` 中 16 张截图与 `contact-sheet.jpg`。

## 并排视觉核对

| 对照项 | 结果 |
| --- | --- |
| 工作台信息密度、KPI、待办与趋势 | passed |
| 客户列表和高级筛选 Drawer | passed |
| 客户对象 Page Tabs 与 AI 状态 | passed |
| 会话四栏布局 | passed |
| 预约周历与 Availability Drawer | passed |
| 随访方案三栏设计器 | passed |
| 知识空间、类型 Tab 与表格 | passed |
| 经营分析和策略结构 | passed |
| Connector 卡片与 Capability Matrix | passed |
| HIS 十步接入向导 | passed |

## 交互与响应式核对

- Sidebar 展开/收起、七大栏目选中态、页面级二级导航：passed。
- Workspace 固定工作台、横向滚动、快速打开、标签管理、对象 Tab：passed。
- Drawer/搜索 Dialog 的打开、关闭、Esc、Focus Trap 与焦点恢复：passed。
- Page Tabs 键盘切换、禁用原因、日期范围与正式图标：passed。
- 1600/1440/1280 三档无关键重叠、按钮越界、Drawer 超屏或整页横向滚动：passed。
- 表格与四栏工作区在窄桌面尺寸内保持局部布局边界：passed。

## 数据真实性核对

- 正式页面没有 DEMO 成功数据、假指标、假消息、假空闲时段或假连接状态：passed。
- 视觉 fixture 有明确 DEMO 标识，未写数据库/API/Storage，截图后已从源码移除：passed。
- Capability-off、External Contract Required 和 Not Configured 状态均可见：passed。

final result: passed

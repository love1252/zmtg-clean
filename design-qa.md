# 机构端 V1.1 Approved 正式入口同步 Design QA

## 审查对象

- 视觉事实源：`.codex-reference/institution-v1.1-approved/ZMTG_INSTITUTION_PROTOTYPE_V1_1_APPROVED/screenshots/01-workbench.png` 至 `10-his-onboarding.png`。
- 交互事实源：`.codex-reference/institution-v1.1-approved/ZMTG_INSTITUTION_PROTOTYPE_V1_1_APPROVED/institution.html`。
- 事实源 SHA-256：`252de0d7a5e8109ded7596ea015dc6323e5cf197ce2e8dd56f1fa78227e1d87a`。
- 当前实现：`http://127.0.0.1:5010/hospital`。仅在本地开发环境且当前账号通过机构工作台服务端授权时同步 Approved 界面；本地授权失败进入登录页，不再渲染旧工作台壳层；生产环境继续保留原 fail-closed 实现。
- 实现截图：`artifacts/institution-v1.1-exact-approved-runtime/implementation-01-workbench.png` 至 `implementation-10-his-onboarding.png`。
- 完整并排证据：`artifacts/institution-v1.1-exact-approved-runtime/comparisons/contact-sheet-10-comparisons.jpg`。
- 正式入口工作台截图：`artifacts/institution-v1.1-hospital-sync/current/hospital-workbench-1600x1000.png`。
- 正式入口工作台并排证据：`artifacts/institution-v1.1-hospital-sync/comparisons/workbench-approved-vs-hospital.png`。

## 视口与归一化

- CSS 视口：`1600 × 1000`。
- 设备像素比：`1`。
- Approved 源图：`1600 × 1000` PNG。
- 当前实现截图：`1600 × 1000` PNG。
- 状态归一化：每个场景均先保留固定工作台 Tab、关闭其他 Workspace Tab、关闭已展开的二级导航、清理客户筛选标签，再进入与 Approved 截图相同的路由和交互状态。
- 密度归一化：源图与实现图尺寸和密度一致，不进行拉伸或裁切。

## 全视图对照

十组同状态并排图位于 `artifacts/institution-v1.1-exact-approved-runtime/comparisons/compare-*.png`：

1. 工作台；
2. 客户高级筛选 Drawer；
3. 客户画像 / 沟通洞察；
4. 会话工作台；
5. 预约周历；
6. 随访方案设计器；
7. 知识库；
8. 经营策略；
9. Connector 总览；
10. HIS 接入向导。

全视图核对未发现会改变区域比例、首屏内容、排版密度、侧栏层级、表格列宽、Drawer/Modal 尺寸或页面结构的可见偏差。

`/hospital` 正式入口另以 `1600 × 1000` 同状态重新采集。Approved 工作台位于并排图左侧，正式入口位于右侧；归一二级导航展开状态后，两侧 Shell、Sidebar、Topbar、Workspace、卡片网格、列表密度和图表区域一致。

## 聚焦区域对照

- 客户高级筛选：核对右侧 Drawer 宽度、基础资料、客户归属、数据来源、预约/治疗/消费、随访/沟通/渠道、AI 与经营机会分组及固定底部操作区。
- HIS 接入向导：核对遮罩、Modal 尺寸、十步进度条、字段布局、按钮位置和背景 Connector 卡片。
- 会话工作台：核对账号列、会话列、消息区和业务上下文四栏比例。
- 随访方案设计器：核对左侧触发条件、中间可视化时间轴和右侧节点设置三栏比例。

上述密集区域在并排图中可直接读取，未发现需要额外放大才能判断的 P0/P1/P2 偏差。

## 必查视觉面

| 视觉面 | 结果 | 证据 |
| --- | --- | --- |
| 字体与排版 | passed | 使用 Approved HTML 的原始字体栈、字号、字重、行高、截断和层级 |
| 间距与布局节奏 | passed | Shell、Sidebar、Topbar、Workspace、卡片、表格、Drawer、Modal 与 Approved 同源 |
| 色彩与设计 Token | passed | 背景、边框、状态色、遮罩、渐变与 Approved 同源 |
| 图标与资源质量 | passed | 使用 Approved 原型内置正式图标与原始静态资源，无 Emoji、占位图或近似绘制 |
| 文案与业务内容 | passed | 页面名称、标签、状态、说明、演示数据与 Approved 原型一致 |

不同浏览器截图之间存在亚像素抗锯齿和颜色合成差异，但并排核对中没有形成可见布局或样式偏差，不构成可执行的 P0/P1/P2 问题。

## 交互核对

- Approved 14 条机构端路由：`14/14 passed`。
- Sidebar 展开/收起：passed。
- Workspace 快速打开、全局搜索、标签管理、固定工作台、动态客户 Tab 去重：passed。
- 客户高级筛选 Drawer 打开、应用筛选和筛选标签回填：passed。
- 客户画像 Page Tab、沟通洞察 Component Tab：passed。
- 会话 AI 建议、采用、人工接管：passed。
- Availability Drawer、选择时段、预约确认 Drawer：passed。
- 随访执行 Drawer、暂存、完成：passed。
- 随访方案模拟测试：passed。
- 知识详情和 AI 检索测试：passed。
- 经营策略证据 Drawer 与情景模拟：passed。
- Connector 详情 Drawer、HIS 向导前进/后退/取消：passed。
- 登录域名 `127.0.0.1` 下的 `/hospital` 正式入口装载：passed。
- `/hospital` 七大栏目、客户列表、预约管理、随访管理、随访方案、知识库、经营分析和管理中心跳转：passed。
- `/hospital` 客户更多筛选 Drawer、全局搜索、HIS 接入向导前进与关闭：passed。
- `/hospital` 浏览器控制台错误：0。
- 原型包自带校验：`69/69` Runtime Case、68 个静态 Action、14 个截图场景、内部 SHA-256 全部 passed。

## 对比迭代记录

### 迭代 1

- 发现：此前近似 React 视觉预览与 Approved 原型在 Sidebar、客户列表、页面密度和深层交互上存在 P1 级差异。
- 修正：开发预览入口改为只读加载用户指定的完整 Approved 包，不再渲染近似页面。
- 复核：十组同状态并排图未再出现上述视觉差异。

### 迭代 2

- 发现：Approved HTML 中 Drawer/Modal 的内联冒泡拦截导致内部动作按钮不可执行，属于 P0 交互阻断。
- 修正：仅在开发预览响应中增加动作优先级兼容桥接；`.codex-reference` 中的源文件未修改。
- 复核：高级筛选、预约选时段、随访执行、方案模拟、知识测试、经营策略、Connector 与 HIS 向导均通过真实浏览器操作。

### 迭代 3

- 发现：首次截图继承了前序操作产生的 Workspace Tab、已展开二级导航和筛选标签，造成非同状态 P2 对照噪声。
- 修正：按每张 Approved 截图的初始状态归一化 Workspace、导航和筛选，再重新采集全部十组截图。
- 复核：`contact-sheet-10-comparisons.jpg` 与十张 `compare-*.png` 均为相同视口、相同路由、相同交互状态。

### 迭代 4

- 发现：Approved 精确运行版仅位于独立预览路由，登录后的 `/hospital` 仍展示原安全壳层，属于正式入口同步缺口。
- 修正：在 `/hospital` 保留原服务端机构导航授权；仅当本地开发环境且工作台访问真实允许时，以受保护的同源 Frame 装载 Approved 运行时。Frame 内容使用无缓存、禁止网络连接的 CSP，并在第二个服务端请求再次核验授权。
- 复核：当前登录域名下 `/hospital` 已显示 Approved 工作台；七大栏目和核心 Drawer、Modal、搜索交互通过。未登录或授权失败时不读取原型文件并进入登录页，测试和生产环境不启用正式入口同步。

## 边界

- 这是 Approved 原型在本地开发环境的正式 `/hospital` 登录后视觉入口，用于先行确认界面和交互，不等同于正式业务 Domain/API/Reader/Writer 实现。
- 本地开发环境的 `/hospital` 不再显示旧工作台壳层：有效机构登录显示 Approved 界面，无有效机构登录进入 `/login`。
- 不连接真实 HIS、数据库、企业微信、个人微信或 AI Provider。
- 不执行真实消息发送、预约写入、数据库写入或外部上传。
- 不修改 Auth、Capability、Schema、Migration、平台端、官网或登录页；正式入口复用现有机构工作台服务端授权，授权失败继续 fail-closed。
- 本报告不包含 Ready、Merge 或部署结论；本地截图证据不纳入源码提交。

## 结论

当前本地 `/hospital` 已达到 Approved 原型的同源视觉与交互呈现；十组核心状态没有剩余可执行 P0/P1/P2 视觉问题，关键交互均可操作。

final result: passed

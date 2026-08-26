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
- 本轮响应式修正证据：`artifacts/institution-v1.1-dashboard-layout-correction/after-1280x800.png`、`after-1440x900.png`、`after-1600x1000.png`。
- 本轮并排证据：`artifacts/institution-v1.1-dashboard-layout-correction/compare-approved-vs-refined-1600x1000.jpg`。左侧为 Approved 原图，右侧为用户标注后的局部细化实现。
- 账号交互修正证据：`artifacts/institution-v1.1-account-interaction-correction/admin-profile-menu.png`、`personal-info-modal.png`、`logout-confirmation.png`。
- 账号区修正前后对照：`artifacts/institution-v1.1-account-interaction-correction/comparison-before-vs-admin-profile.png`。
- 本轮顶部精简与标签对齐证据：`artifacts/institution-v1.1-annotation-correction/01-before.png`、`02-after.png`。
- 本轮修正前后同视口并排证据：`artifacts/institution-v1.1-annotation-correction/03-before-after-comparison.png`。
- 本轮正式入口复核截图：`artifacts/institution-v1.1-annotation-correction/05-formal-hospital-chrome.png`。
- 本轮品牌区展开与收起截图：`artifacts/institution-v1.1-brand-logo-correction/02-after-expanded.png`、`03-after-collapsed.png`。
- 本轮官网 Logo 聚焦对照：`artifacts/institution-v1.1-brand-logo-correction/04-logo-reference-vs-sidebar.png`；修正前后全视图对照：`05-before-after-full.png`。
- 本轮正式入口品牌复核：`artifacts/institution-v1.1-brand-logo-correction/06-formal-hospital.png`。
- 本轮统一日期选择器事实源副本：`artifacts/institution-v1.1-unified-date-range-correction/00-source-date-range-reference.png`；当前空范围状态：`03-after-date-picker.png`；跨月范围状态：`04-after-cross-month-range.png`。
- 本轮日期选择器同状态聚焦并排图：`artifacts/institution-v1.1-unified-date-range-correction/06-source-vs-implementation.png`。左侧为用户附带参考，右侧为当前双月范围选择器。
- 本轮正式 `/hospital` 日期选择器复核：`artifacts/institution-v1.1-unified-date-range-correction/07-formal-hospital-date-picker.png`。
- 本轮侧边栏修正前后截图：`artifacts/institution-v1.1-sidebar-width-color-correction/01-before-expanded.png`、`02-after-expanded.png`；收起状态：`03-after-collapsed.png`。
- 本轮侧边栏同视口全视图与聚焦并排证据：`artifacts/institution-v1.1-sidebar-width-color-correction/04-before-after-full.png`、`05-before-after-sidebar-focus.png`。
- 本轮窄屏自适应事实源：`artifacts/institution-v1.1-responsive-shell-correction/00-user-logo-annotation.png`、`01-user-responsive-annotation.png`；修正前后：`02-before-922x701.png`、`03-after-922x701.png`。
- 本轮响应式全视图、标注和 Logo 聚焦并排证据：`artifacts/institution-v1.1-responsive-shell-correction/06-before-after-922x701.png`、`07-annotation-after-922x701.png`、`08-logo-before-after-focus.png`；会话窄屏状态：`05-conversation-after-922x701.png`。
- 本轮客户列表真实分页与长表格证据：`artifacts/customer-list-pagination/customer-list-pagination-after.png`；正式 `/hospital` 使用当前登录机构的客户 Reader，截图状态为 `20 条/页`、共 `30` 条、第 `1/2` 页。

## 视口与归一化

- CSS 视口：`1600 × 1000`。
- 响应式复核视口：`1280 × 800`、`1440 × 900`、`1600 × 1000`。
- 设备像素比：`1`。
- Approved 源图：`1600 × 1000` PNG。
- 当前实现截图：`1600 × 1000` PNG。
- 状态归一化：每个场景均先保留固定工作台 Tab、关闭其他 Workspace Tab、关闭已展开的二级导航、清理客户筛选标签，再进入与 Approved 截图相同的路由和交互状态。
- 密度归一化：源图与实现图尺寸和密度一致，不进行拉伸或裁切。
- 日期选择器参考图为用户附带的 `1306 × 792` 聚焦截图，当前空范围选择器聚焦区域为 `840 × 474` CSS 像素；并排图分别等比例置入 `1306 × 792` 白色画布，不拉伸。参考图包含外层业务筛选工具栏，结构对照仅判断日期输入区、双月面板、月份导航、星期与日期网格；当前实现的快捷范围和底部确认区属于可用性补充。
- 侧边栏修正采用用户标注时的实际 `1280 × 701` CSS 视口、设备像素比 `1`；修正前后截图均为 `1280 × 701`，全视图并排不拉伸。聚焦图为两个 `236 × 701` 画布：修正前保持原宽，修正后的 `212px` 侧栏在右侧补等宽白色留白，避免拉伸造成宽度判断失真。
- 本轮用户窄屏标注原图为 `1280 × 973`，其节点证据记录的 CSS 视口为 `922 × 701`；按相同比例使用 Lanczos 归一化为 `922 × 701` 后，与浏览器实际 `922 × 701` 修正截图并排，不改变纵横关系。另复核 `760 × 800` 与 `1280 × 800`；临时视口结束后恢复用户默认 `922 × 701`。

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

本轮按用户在 `/hospital` 上的四处视觉标注做局部细化：待办首列改为会话、预约、随访、机会语义色标签；日程首列增加状态色点并强化等宽时间；顶部栏在窄视口使用弹性搜索宽度和单行标题；账号区在 `1280px` 收敛为头像和展开箭头，在 `1440px`、`1600px` 恢复姓名与角色。上述均为用户明确指定的可接受偏差，其余页面结构和交互保持 Approved 同源。

账号区按当前登录账号进一步修正为 `admin / 机构管理员`：工作台问候、头像和个人菜单使用同一身份；个人信息、账号安全和退出登录均提供可操作界面。退出登录先二次确认，再调用项目既有同源 `/api/auth/logout`，成功后将顶层页面返回 `/login`。

## 聚焦区域对照

- 客户高级筛选：核对右侧 Drawer 宽度、基础资料、客户归属、数据来源、预约/治疗/消费、随访/沟通/渠道、AI 与经营机会分组及固定底部操作区。
- HIS 接入向导：核对遮罩、Modal 尺寸、十步进度条、字段布局、按钮位置和背景 Connector 卡片。
- 会话工作台：核对账号列、会话列、消息区和业务上下文四栏比例。
- 随访方案设计器：核对左侧触发条件、中间可视化时间轴和右侧节点设置三栏比例。
- 双月日期范围选择器：核对“开始日期 至 结束日期”输入结构、左右连续月份、单月/整年导航、周标题、相邻月份弱化、当前日期状态、边框、分隔线和排版密度；空范围与跨月范围两种状态均有浏览器证据。
- 侧边栏：核对展开宽度、主内容可用宽度、品牌资产完整性、导航文字留白、深色背景与浅色工作区的冷暖关系、选中态辨识度和收起状态居中；前后同视口全视图与聚焦并排均可直接判断。
- 窄屏工作台：核对 `922px` 下整页边界、自动收起侧栏、顶部栏、Workspace 横向滚动、KPI 三列、工作台双栏、日期操作区和纵向内容滚动；同时核对会话三栏紧凑布局及其他一级栏目页面边界。

上述密集区域在并排图中可直接读取，未发现需要额外放大才能判断的 P0/P1/P2 偏差。

## 必查视觉面

| 视觉面 | 结果 | 证据 |
| --- | --- | --- |
| 字体与排版 | passed | 保留 Approved 字体栈和层级；顶部标题单行、搜索文案截断，`922px` 与 `1280px` 均未出现标题、账号文字或卡片内容竖排 |
| 间距与布局节奏 | passed | Shell、Workspace、卡片、表格、Drawer、Modal 与 Approved 同源；Sidebar 展开/收起为 `212px / 68px`，`≤1050px` 默认收起；KPI、双栏和三栏布局按 `1050px / 760px` 两级断点重排 |
| 色彩与设计 Token | passed | 主工作区背景、边框和业务状态色保持 Approved；Sidebar 从带青绿色网格的深色背景收敛为冷调深蓝灰三段渐变，选中态同步使用工作区蓝色系，未改变业务语义色 |
| 图标与资源质量 | passed | 使用 Approved 原型内置正式图标与原始静态资源；左上品牌区直接复用官网夜间横版和图形标识，不重新绘制 Logo；展开态约 `132 × 42px`、收起态 `30 × 30px`，比例与清晰度保持完整 |
| 文案与业务内容 | passed | 页面名称、状态、说明和演示数据保持 Approved；新增类型标签只复述既有 `data-pending` 语义；当前操作者身份按用户确认由占位姓名修正为 `admin` |
| 字号与字重层级 | passed | 依据用户提供的舒适字号参考，统一主标题、栏目标题、指标、正文、列表主次信息、表头、按钮、标签和辅助文字；仅标题、关键数值、当前选中项及业务主信息加粗，正文与说明保持常规字重 |

不同浏览器截图之间存在亚像素抗锯齿和颜色合成差异，但并排核对中没有形成可见布局或样式偏差，不构成可执行的 P0/P1/P2 问题。

## 交互核对

- Approved 14 条机构端路由：`14/14 passed`。
- Sidebar 展开/收起：passed；展开 `212px`、收起 `68px`，品牌图和导航图标居中，横向溢出为 `0px`。
- `922 × 701` 窄屏初次装载自动收起 Sidebar，用户仍可手动展开；两种状态 `body.scrollWidth === body.clientWidth`：passed。
- `760 × 800` 紧凑布局使用 KPI 两列、工作台单列和 Workspace 横向滚动；`1280 × 800` 保持桌面三列与双栏：passed。
- 工作台、客户列表、会话工作台、预约、随访、知识库、经营分析、管理中心在 `922px` 下均无整页横向裁切：passed；宽表仅在卡片内部滚动。
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
- `/hospital` 待办分类切换后语义色标签自动恢复：passed。
- `/hospital` 顶部栏三档视口无横向溢出，标题 `nowrap`：passed。
- `/hospital` 账号菜单在窄屏头像模式仍可打开和关闭：passed。
- 账号头像、工作台问候、个人菜单统一显示 `admin`：passed。
- 个人信息弹窗展示账号、角色、机构和状态，且不展示手机号、Cookie、Token：passed。
- 账号安全弹窗展示二次验证和当前会话状态：passed。
- 退出登录二次确认、既有同源 Logout API 契约、成功后顶层返回 `/login`：passed（浏览器复核未执行最终退出，以保留当前会话；API 路由测试通过）。
- 客户列表正式 Reader 分页：passed；第 1 页 `20` 条、第 2 页 `10` 条，两页客户集合无重叠；`10/20/50/100` 四档页容量均通过，页容量变化后回到第 1 页并重新读取服务端数据。
- 客户列表长表格：passed；表格卡片使用独立纵向滚动、固定表头和“展开表格 / 收起表格”，`100 条/页` 状态下实测 `scrollHeight=2090px`、`clientHeight=576px`，页面主体不随整张表无限增长。
- 会话“图片 / 文件 / 话术”工具、话术回填和“设置”跳转管理中心：passed。
- 客户详情“编辑客户 / 查看来源证据 / 合并客户”三个更多菜单动作：passed。
- 随访方案“编辑触发条件”和相对执行时间设置：passed。
- Excel 导入警告详情、脱敏错误明细、重复客户三种处理结果：仅为 Approved 原型的静态演示状态；本轮审计确认其不构成真实文件读取或数据库导入证据。
- 管理中心新增成员、新建分群、新建机会、Connector 能力测试和受控同步确认：passed；均明确保持真实外部连接和数据库写入关闭。
- 工作台、客户最近到店、客户高级筛选、客户出生日期、预约、随访、经营分析、经营日历和管理设置的全部现有日期入口统一打开同一双月范围选择器：passed。
- 日期快捷范围、前后月、前后年、起止选择、跨月高亮、应用回填和刷新恢复：passed。
- 登录授权浏览器中的正式 `/hospital` 工作台日期入口：passed；控制台错误和警告为 `0`。
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

### 迭代 5

- 发现：用户在 `1280px` 实际视口中标注了四项 P2：待办类型仍为单色图标、日程缺少状态点、顶部标题与搜索区域受到挤压、账号姓名和角色形成竖排。
- 修正：保持 `.codex-reference` 只读，在受保护的 Approved 响应中注入作用域明确的样式和 DOM 装饰；列表重渲染后由 `MutationObserver` 恢复语义标签和状态点，顶部栏使用弹性宽度、单行截断和分档账号信息。
- 复核：`1280 × 800`、`1440 × 900`、`1600 × 1000` 的 `body.scrollWidth === body.clientWidth`；顶部栏所有子项均位于视口内；标题高度保持单行；窄屏账号菜单、待办 Component Tab 和既有页面交互仍可操作。

### 迭代 6

- 发现：账号区仍使用 Approved 演示占位姓名“王小美”，个人信息、账号安全和退出登录菜单项没有动作，属于当前登录身份不一致和 P1 交互缺口。
- 修正：在只读 Approved 响应细化层中统一显示 `admin / 机构管理员`；补充低敏个人信息与账号安全 Modal；退出登录增加二次确认，复用既有 `POST /api/auth/logout` 并在成功后跳转顶层登录页。CSP 仅由禁止全部连接收敛为允许同源连接，不允许外部网络。
- 复核：账号菜单三个动作均有明确 `data-action`；个人信息和账号安全 Modal 可打开、关闭且不会遗留 Popover；退出确认按钮可用；Logout API 清除正式与演示会话 Cookie 的既有测试通过；浏览器控制台错误和警告为 0。

### 迭代 7

- 发现：Approved 源文件仍有一批只展示按钮但没有具体动作的控件，包括客户批量分群和分页、会话图片/文件/话术、客户更多菜单、随访方案触发条件、日历月份切换、Excel 导入警告/错误/重复处理，以及管理中心部分新增和 Connector 操作。
- 修正：保持 `.codex-reference` 只读，在同源 Approved 运行时适配层补齐上述 Drawer、Modal、Popover、页内状态、表单回填、分页反馈和页面跳转。下载仅生成当前可见脱敏预览数据；Connector、同步、附件、客户合并和导入流程均明确为本地预览，不执行真实写入或外部连接。
- 复核：真实浏览器逐项通过批量分群、筛选、分页、会话话术回填、附件选择界面、会话设置跳转、成员新增、方案触发编辑、相对时间、客户来源证据、导入错误详情和日历月份切换；`artifacts/institution-v1.1-interaction-completion-audit/` 保存本轮前后截图与 Approved 并排证据。

### 迭代 8

- 发现：Approved 原始样式在表格、列表辅助信息、状态标签和会话工作台中大量使用 `10–12px` 小字号，标题与正文之间的字重差异也不够稳定；窄屏会话头部的操作按钮会受到四栏宽度挤压。
- 修正：按用户提供的工作台截图建立统一字体层级：页面主标题 `23–24px`，卡片标题 `16px`，指标数值 `25–26px`，正文与列表主信息 `13–14px`，辅助信息与状态标签 `10–11px`；加粗仅用于页面/卡片标题、关键指标、当前选中项、客户与任务主信息。同步收紧窄屏会话四栏比例并锁定操作区、负责人和操作列不折行。
- 复核：工作台、客户列表和会话工作台在当前浏览器视口无标题挤压、操作文字竖排或负责人断行；参考图与当前实现已生成并排图，截图证据位于 `artifacts/institution-v1.1-typography-refinement/`。

### 迭代 9

- 发现：用户标注工作台待办列表的“高 / 中 / 低”优先级标签横向位置不一致；顶部版本徽标、机构卡片和“全产品入口”不再需要，属于三项明确的局部界面调整。
- 修正：为待办优先级与时间建立固定宽度尾列，使五行标签左边缘和时间列分别对齐；在运行时细化层移除 `V1.1 APPROVED`、`上海美颜` 和“全产品入口”，搜索、消息、通知、帮助和 admin 账号区保持不变。
- 复核：同一视口五个优先级标签左坐标均为 `908px`、宽度均为 `28px`，五个时间单元左坐标均为 `946px`、宽度均为 `44px`；三个指定顶部元素均不存在，页面横向溢出为 `0px`。正式 `/hospital` 已在保留登录授权的浏览器中重新加载，呈现结果一致且控制台错误/警告为 `0`；修正前后并排证据位于 `artifacts/institution-v1.1-annotation-correction/03-before-after-comparison.png`。

### 迭代 10

- 发现：左上品牌区仍是原型占位渐变图标和两行文本，没有使用智美天工官网正式品牌标识；日间深蓝横版直接放入深色侧栏时对比度不足。
- 修正：展开侧栏复用官网深色主题同源资源 `/brand/zmtg-logo-horizontal-night-clean.png`，使用白色文字和青色节点匹配深海军蓝侧栏；收起侧栏切换为 `/brand/logo-mark.png`，放入轻量白色承托面以保持深蓝线条清晰。没有重绘、变色或生成替代 Logo。
- 复核：展开状态品牌图尺寸为 `163 × 52px`，品牌容器为 `236 × 64px`；收起状态图形标识为 `34 × 34px`，侧栏宽度为 `76px`。两种状态横向溢出均为 `0px`，展开/收起交互保持正常；正式 `/hospital` 重新加载后使用同一品牌资源，控制台错误/警告为 `0`。官网 Logo 与当前侧栏聚焦对照位于 `artifacts/institution-v1.1-brand-logo-correction/04-logo-reference-vs-sidebar.png`。

### 迭代 11

- 发现：Approved 原始运行时的日期入口使用单月 Modal，月份箭头仅有局部适配；不同页面的工作台周期、筛选日期、预约范围、随访范围、经营分析周期和管理默认范围没有形成用户指定的统一“双月范围”交互，属于 P1 一致性与可用性缺口。
- 修正：在只读 Approved 响应适配层新增一套统一双月范围选择器，不修改 `.codex-reference`。组件使用“开始日期 至 结束日期”输入结构，左右连续月份、前后月/前后年导航、相邻日期弱化、今天状态、起止与范围高亮、今天/近 7 天/近 30 天/本月快捷范围、取消和应用；所有现有日期动作复用同一实现，应用后回填原页面状态并随刷新恢复。
- 复核：工作台、客户列表、客户高级筛选、新建客户、预约、随访、经营分析、经营日历和管理设置逐项通过真实浏览器操作；跨月选择 `2026-09-05 至 2026-10-03` 后只有两个端点高亮，回填和刷新恢复正常。参考与当前空范围状态并排证据位于 `artifacts/institution-v1.1-unified-date-range-correction/06-source-vs-implementation.png`，没有剩余可执行 P0/P1/P2 差异。

### 迭代 12

- 发现：用户在 `1280 × 701` 实际视口中标注 Sidebar 占用横向空间偏多，原青绿色网格深色背景与当前浅蓝灰工作区和蓝色交互强调不够协调，属于 P2 比例与色彩一致性问题。
- 修正：展开宽度从 `236px` 收窄为 `212px`，收起宽度从 `76px` 收窄为 `68px`；移除网格纹理，改用 `#0d2a40 → #0a2234 → #081c2c` 冷调深蓝灰渐变，并将激活态调整为同一蓝色系。保持正式 Logo、七大栏目、二级导航、折叠按钮和全部路由行为不变。
- 复核：同一浏览器同一视口中侧栏宽度精确为 `212px`，品牌图保持 `163 × 52px`，`scrollWidth === clientWidth`；收起状态宽度为 `68px`，`34 × 34px` Logo 图形标识在横向 `17px` 处居中。前后全视图与侧栏聚焦并排图未发现剩余 P0/P1/P2 差异。

### 迭代 13

- 发现：用户在 `922 × 701` 实际视口中标注品牌横版占比仍偏大；Approved 的 `.app{min-width:1180px}` 使窄屏页面实际宽度保持 `1180px`，导致工作台右侧 KPI、日期按钮和今日安排被视口截断，属于 P1 响应式可用性问题。
- 修正：品牌横版从 `163 × 52px` 缩小为约 `132 × 42px`，收起图形标识从 `34px` 缩小为 `30px`。移除窄屏最小宽度，增加 `1050px / 760px` 两级响应式布局：窄屏首次装载自动收起侧栏，Workspace 可横向滚动，KPI 在三列/两列间切换，工作台双栏在紧凑屏改为单列，页面头部和操作区允许重排；Drawer、Modal、表格、会话和方案设计器限制在当前视口或组件内部滚动。
- 复核：`922px` 下修正前 `body.scrollWidth=1180`，修正后 `body.scrollWidth=body.clientWidth=922`；工作台页面 `scrollWidth=clientWidth=839`，主区域宽 `854px`，KPI 为三列、待办/日程为完整双栏。七大栏目逐页均无 Body 横向溢出；会话页边界为 `68–922px`，不再超出页面。`760px` 与 `1280px` 断点实测通过，控制台错误/警告为 `0`。

### 迭代 14

- 发现：用户在 `922 × 701` 展开侧栏中标注横版 Logo 靠近品牌卡片左侧，希望 Logo 在 `212 × 64px` 品牌区域内居中，属于 P2 对齐问题。
- 修正：保持 Logo 尺寸、品牌资源和侧栏宽度不变，将品牌承载层改为水平与垂直双向居中，并将横版图片的对象定位统一为中心。
- 复核：真实浏览器展开侧栏下，品牌卡片中心为 `(105.5, 32)`，横版 Logo 中心为 `(105.5, 31.5)`，横向中心偏差 `0px`、纵向中心偏差小于 `1px`；横版 Logo 仍为约 `132 × 42px`。收起状态继续使用独立 `30 × 30px` 图形标识，未改变窄屏自动收起和全部页面布局。

### 迭代 15

- 发现：Excel 导入第 2 步的“上传文件”只是把 `importSelected` 改为 `true`，没有真实 `<input type="file">`；第 3–6 步的字段映射、数量、错误、重复客户和完成状态均为写死演示数据，属于 P0 交互阻断和假成功风险。
- 修正：在只读 Approved 响应适配层接入真实操作系统文件选择器，同时支持点击、键盘和拖放；仅接受 `.xlsx`，校验非空、10 MB 上限和 ZIP 文件头。文件只保存在当前浏览器内存中，未读取姓名、手机号或业务载荷。当前正式 Capability Registry 没有客户 Excel 批量导入能力，模板“消费记录”也没有可复用的 Canonical Writer，因此下一步改为明确的 `CAPABILITY OFF` 边界说明，不再进入写死的字段映射和假完成流程。
- 复核：字符串级 Runtime 测试覆盖真实文件输入、格式/大小/文件头校验、动作拦截、内存边界和 Capability-off 说明；`ApprovedPrototypeAssets.test.ts` 与 `InstitutionV11HospitalRoute.test.ts` 共 `17/17` 通过。浏览器已验证导入入口与 Modal 可达，但当前浏览器控制工具在 iframe 内继续定位文件选择控件时超时并重置会话，未取得修正后原生文件选择和拖放的完整浏览器证据。

### 迭代 16

- 发现：客户列表页脚原有 `1 / 2 / 3` 仅切换按钮高亮，表格始终显示同一组 5 条演示记录；列表没有页容量选择，长列表只能拉长整个页面，属于 P0 数据分页失效和 P1 可用性缺口。
- 修正：保持客户 Canonical Owner 不变，扩展现有低敏客户 Reader 与 Repository 的分页契约，增加同一 `tenantId + institutionId` 条件下的真实总数查询和 `10/20/50/100` 白名单页容量。Approved 运行时改为调用既有 `/api/v1/institution/customers`，不再回退静态客户行；Reader 未提供的来源、任务、微信和负责人字段明确显示“未读取 / 未接入投影”。表格卡片增加独立滚动、固定表头和展开收起控制。
- 复核：真实登录浏览器中共读取 `30` 条本地开发库客户；`20 条/页` 的第 1 页与第 2 页分别为 `20/10` 条且无重叠，`10 条/页` 为 3 页，`50/100 条/页` 均在 1 页显示全部 30 条。表格固定表头、独立滚动和展开收起实测通过；分页、Repository、API、页面与 Approved 适配层 `74/74` 个定向测试通过。

## 边界

- 这是 Approved 原型在本地开发环境的正式 `/hospital` 登录后视觉入口，用于先行确认界面和交互，不等同于正式业务 Domain/API/Reader/Writer 实现。
- 本地开发环境的 `/hospital` 不再显示旧工作台壳层：有效机构登录显示 Approved 界面，无有效机构登录进入 `/login`。
- 不连接真实 HIS、数据库、企业微信、个人微信或 AI Provider。
- Approved 运行页仅允许同源请求，以支持既有退出登录 API；CSP 不允许 `https:` 或其他外部连接。
- 不执行真实消息发送、预约写入、数据库写入或外部上传。
- 不修改 Auth、Capability、Schema、Migration、平台端、官网或登录页；正式入口复用现有机构工作台服务端授权，授权失败继续 fail-closed。
- 本报告不包含 Ready、Merge 或部署结论；本地截图证据不纳入源码提交。

## 结论

当前客户列表分页专项已完成：页码会读取不同的正式客户记录，支持 `10/20/50/100` 条切换，长表格在卡片内部滚动并固定表头，缺失业务投影不再用原型数据填充。该结论只覆盖本轮客户列表分页与表格可用性，不重新判定其他历史交互范围。

final result: passed (current customer pagination scope)

# 机构端 V1.1 七大栏目页面还原报告

## 结论

- 基线：`731af151d45e88bf740df5a4e4558edd8b9c9d95`
- 参考版本：`V1.1_APPROVED`
- 页面矩阵：34 个页面/页面态，视觉与安全交互均为 `RESTORED`
- 视觉证据：16 张 1600×1000 核心截图及 1 张 Contact Sheet
- 范围：仅机构端；未改平台端、官网、登录、Schema、Migration、数据库连接或外部 Connector

本轮保留现有安全 Shell、Canonical Owner、Reader、Writer、Repository、权限和租户边界，只补齐页面组合、只读 UI 映射、Capability 状态、公共交互与定向测试。底层没有正式契约的能力以完整页面结构呈现，但保持禁用、未配置或外部契约待接入状态。

## 七大栏目交付

| 栏目 | 还原内容 | 正式数据边界 |
| --- | --- | --- |
| 工作台 | 页面头、KPI 区、待处理、今日安排、风险与机会、动态与趋势布局 | 继续消费既有 Action、Lifecycle、Capability Projection；未知指标不显示为 0 |
| 客户中心 | 客户列表、服务端筛选、高级筛选 Drawer、对象 Page Tabs、AI 洞察状态、六步 Excel 导入结构、分群与机会状态 | 仅 lifecycle/priority 进入正式服务端筛选；画像、分群、导入 Writer 不开放 |
| 会话工作台 | 微信账号、会话列表、消息区、上下文区四栏布局，发送区与 Connector 状态 | 队列使用低敏 Reader；真实登录、入站、发送和 AI 自动回复关闭 |
| 预约与随访 | 预约列表/周历、Availability Drawer、随访管理、任务与消息状态分离、随访方案设计器 | 正式 Appointment/Follow-up Reader/Command 不变；Availability、HIS mutation、真实消息发送关闭 |
| 知识库 | 知识空间、类型 Tab、资料表格、编辑 Workspace、检索/上传/AI 测试状态 | 只展示已发布元数据；不新增知识 Writer，不调用 AI Provider |
| 经营分析 | 指标口径、来源、更新时间、新鲜度、分析 Tab 与经营策略结构 | 只展示正式可计算聚合；不生成营收、利润、转化率或 AI 策略 |
| 管理中心 | 机构配置页组、Connector 卡片、Capability Matrix、数据同步状态、AI/审计状态、HIS 十步向导 | Secret 不进入客户端；不执行数据库连接、真实授权、同步或外部调用 |

## 公共 Shell 与交互

- 复用现有 `InstitutionNavigationShell` 与 `InstitutionWorkspaceFrame`，没有创建第二套 Shell。
- 深色 Sidebar 保留七大栏目、展开/收起、当前栏目与页面级二级导航。
- Workspace 继续使用 Next.js `usePathname` / `useRouter`、页面级 Capability 白名单、作用域隔离、最多 8 个 Tab、对象 Tab 脱敏标题和完整标签管理。
- 修复 Hydration 时序竞争：当前作用域路径在 Hydration 帧内原子持久化，已 Hydration 的 Tab 合并不再排队额外 RAF；切换 actor/tenant/institution 时不会短暂泄露或延迟覆盖旧作用域标签。
- 全局搜索、Drawer、Popover、Page Tabs、日期范围控件、键盘/Esc、Focus Trap、禁用原因和正式 Lucide 图标统一复用。
- 1600×1000、1440×900、1280×800 三种桌面尺寸均无整页横向溢出；Drawer 与搜索 Dialog 均保持在视口内。

## 复用契约

### API / Reader

- Customer：`/api/v1/institution/customers*`、`readCurrentInstitutionCustomersV1`、受控对象读取。
- Conversation：`/api/v1/institution/conversations*`、`readCurrentInstitutionConversationQueueV1`、受控详情运行时。
- Appointment / Follow-up：`/api/v1/institution/appointments*`、正式 Follow-up Reader 与现有命令服务。
- Knowledge：`/api/v1/institution/knowledge-documents`、`readCurrentInstitutionKnowledgeDocumentsV1`。
- Analytics：`/api/v1/institution/analytics`、`readCurrentInstitutionAnalyticsOverviewV1`。
- Audit / AI usage：既有低敏审计与正式用量 Reader。
- 客户、预约与知识列表的客户端页面只引用纯常量/类型分页契约；正式 Reader 保持服务端唯一实现，避免把 `node:util/types` 带入浏览器包。

### Writer / Canonical Owner

- 没有新增 Writer、Repository、Domain 或平行 Canonical Owner。
- Customer、Conversation、Appointment、Follow-up、Knowledge 继续走现有受控命令；Capability-off 页面不调用这些 Writer。
- 页面未直接写消息、预约、随访、知识、Connector 或数据库表。

## Capability-off 与外部依赖

- 客户 AI 画像、分群、经营机会、Excel 导入 Writer。
- 自动触达、真实消息发送/入站、企业微信授权、个人微信登录。
- Availability、HIS mutation、随访方案 Writer。
- 知识编辑 Writer、正式 AI 检索/问答 Provider 与统一 Evidence。
- 经营策略/报告模型及不足以由正式事实计算的经营指标。
- HIS、医院数据库、企业微信、个人微信和 AI Provider 的真实连接。

这些页面不使用 `localStorage`、临时 JSON、演示成功态或模拟生产数据补齐底层能力。

## 视觉证据

- 路径：`artifacts/institution-v1.1-seven-domain-restoration/`
- 核心截图：`01-workbench.png` 至 `16-global-search-workspace-management.png`
- 汇总：`contact-sheet.jpg`
- Approved 并排核对：工作台、高级筛选、客户 AI、会话、预约、随访方案、知识库、经营策略、Connector、HIS 向导共 10 组。
- 截图使用明确的 `DEMO-ONLY · VISUAL REVIEW` 本地 fixture；fixture 已从生产源码移除，未进入 API、数据库或生产默认数据。

## 验证

- 定向页面、导航、Workspace、Capability、权限、租户与安全测试：69 个文件，970 项通过。
- Workspace Hydration 稳定性复验：连续 8 轮、128 项通过。
- TypeScript：通过。
- ESLint：0 error；4 个既有非本任务 `<img>` warning。
- 全量测试：578 个文件、7,496 项通过。
- Build：通过；仅保留仓库既有 `metadataBase` 提示。
- Git diff 检查：通过。
- 架构检查：`731af151..HEAD` 通过，未发现新增架构违规。
- `next-env.d.ts` 的 Next.js dev 自动漂移已恢复为基线内容。

## 回滚

本轮不含 Schema、Migration、数据库或外部系统状态变更；如需回滚，只需回退本轮单一 Commit。截图和桌面审查包均为本地证据，不参与运行时。

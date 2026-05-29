# 机构端业务壳第一阶段设计

## 目标

在 `/hospital` 机构工作台内补齐第一批核心业务模块壳，让当前项目从静态经营看板升级为可导航、可演示的机构运营工作台。

本阶段聚焦前端展示与静态领域数据边界，只做以下三块：

- 客户中心
- 预约中心
- 智能随访

本阶段不接真实数据库，不新增正式接口，不实现真实租户数据读取，不处理生产级权限模型，不调用外部 AI、企微、短信、Webhook、OAuth 或 API Key 能力。

## 当前状态

`/hospital` 页面由 `InstitutionWorkspace` 渲染，并通过 `DemoSessionGate` 做演示登录拦截。现有工作台已经包含机构端侧边栏、移动端导航、经营指标、AI 建议、今日行动队列和客户旅程看板。

之前的问题是导航按钮只展示样式，不切换主内容区；业务数据也集中在工作台领域文件里，后续扩展机构模块时边界不够清楚。

## 范围

第一阶段只增加三类业务壳：

- 客户中心：展示客户分层、客户优先级队列、负责人、下一步动作和数据边界提醒。
- 预约中心：展示待确认、已确认、已到院、改约跟进四类预约流转和运营提醒。
- 智能随访：展示术后关怀、复购召回、沉默唤醒旅程，随访任务和演示话术建议。

工作台默认仍停留在首页看板。点击侧边栏或移动端导航后，在同一个 `/hospital` 页面内切换内容。

## 非目标

本阶段明确不做：

- 数据库模型、迁移脚本、种子数据。
- 真实客户资料、真实预约写入、真实随访执行。
- 租户切换、跨租户查询、正式 RBAC。
- 客户增删改查接口。
- 企微、短信、Webhook、OAuth、API Key。
- 本地存储业务状态。
- AI 供应商调用或知识库检索。

## 体验设计

`/hospital` 应该像一个机构运营控制台，而不是营销落地页。

交互要求：

- 桌面端侧边栏可以切换工作台、客户中心、预约中心、智能随访。
- 移动端横向导航提供同样的切换能力。
- 当前激活导航项需要有明确视觉状态。
- 首页大标题和经营概览只出现在工作台首页。
- 业务模块使用信息密度更高的运营布局，不使用大面积宣传式首屏。

客户中心需要展示：

- 客户分层指标卡。
- 看起来可搜索的客户列表壳。
- 客户优先级、生命周期、兴趣项目、负责人和下一步动作。
- 侧栏提醒：演示规则、人工承接建议、敏感信息边界。

预约中心需要展示：

- 今日预约流转。
- 待确认、已确认、已到院、改约跟进四类状态。
- 每张预约卡包含客户、项目、时间、负责人和备注。
- 爽约风险、专家档期冲突等运营提醒。

智能随访需要展示：

- 随访旅程概览。
- 按客户阶段排列的任务队列。
- 演示话术建议。
- 明确提示这些话术只是演示建议，不代表真实自动触达或医疗判断。

## 代码结构

新增机构业务模块目录：

```text
src/modules/institution/
  components/
    AppointmentCenterShell.tsx
    CustomerCenterShell.tsx
    SmartFollowUpShell.tsx
  domain/
    appointments.ts
    customers.ts
    followups.ts
  tests/
    InstitutionBusinessDomain.test.ts
    InstitutionBusinessShells.test.tsx
```

调整工作台相关文件：

```text
src/modules/workspace/domain/institution-dashboard.ts
src/modules/workspace/components/InstitutionWorkspace.tsx
src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

`InstitutionWorkspace` 负责保存当前视图状态。导航项需要稳定的 `id`，页面通过 `activeView` 判断渲染工作台首页、客户中心、预约中心、智能随访或其他模块占位。

## 数据边界

所有业务记录都是静态演示数据，并且需要有类型约束：

- `CustomerSummary`
- `CustomerSegment`
- `AppointmentSummary`
- `AppointmentPipelineGroup`
- `FollowUpJourneySummary`
- `FollowUpTask`

演示数据可以出现虚构客户姓名，但不能出现手机号、身份证号、病历号、真实机构名称或任何看起来像真实客户隐私的数据。

## 安全边界

本阶段继续使用 `DemoSessionGate` 做演示角色入口控制，不新增正式授权模型。

界面文案必须避免让用户误以为真实 API Key、OAuth、Webhook、客户数据或 AI 决策已经生效。涉及 AI 或话术的内容都要明确是演示建议。

## 测试设计

需要覆盖以下内容：

- 机构导航项拥有稳定 `id`，默认激活工作台。
- 客户演示记录包含负责人、生命周期、优先级、下一步动作，并且不包含敏感标识字段。
- 预约流转覆盖待确认、已确认、已到院、改约跟进。
- 随访任务包含阶段、截止时间和建议动作。
- `/hospital` 默认渲染工作台首页。
- 点击客户中心后显示客户业务壳。
- 点击预约中心后显示预约业务壳。
- 点击智能随访后显示随访业务壳。

## 验收方式

命令验收：

```bash
./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

浏览器验收：

- 打开 `http://localhost:5010/login`。
- 使用 `admin / admin123` 登录。
- 确认进入 `/hospital`。
- 桌面端点击客户中心、预约中心、智能随访，确认内容切换正常。
- 在约 `390px` 移动端宽度检查横向导航、卡片排版和是否存在横向溢出。

## 风险

- `InstitutionWorkspace` 继续变大，后续如果新增更多模块，应拆出工作台首页组件。
- 静态演示数据容易被误解为真实业务结果，所以文案必须持续强调演示边界。
- 当前是页面内状态切换，不支持深链接。后续接真实数据和权限时，可以再升级为 `/hospital/customers`、`/hospital/appointments`、`/hospital/followups` 等路由。

## 决策

第一阶段选择页面内切换，而不是新增多级路由。这样能最快验证机构端业务信息架构，也不会在真实数据、租户隔离和权限模型尚未设计完成前过早固化接口边界。

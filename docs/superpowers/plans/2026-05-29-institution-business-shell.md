# 机构端业务壳第一阶段实施计划

## 目标

在 `/hospital` 机构工作台中实现客户中心、预约中心、智能随访三个可切换业务壳，并保持当前阶段只使用静态演示数据，不引入真实持久化、接口和生产级授权。

## 实施原则

- 先写测试，再补实现。
- 静态业务数据放在 `src/modules/institution/domain/`。
- 业务壳组件放在 `src/modules/institution/components/`。
- `/hospital` 工作台只负责导航状态和内容装配。
- 所有用户可见文案使用中文，演示数据明确标注边界。
- 不加入手机号、身份证号、病历号或真实机构客户信息。

## 文件清单

新增文件：

- `src/modules/institution/domain/customers.ts`
- `src/modules/institution/domain/appointments.ts`
- `src/modules/institution/domain/followups.ts`
- `src/modules/institution/components/CustomerCenterShell.tsx`
- `src/modules/institution/components/AppointmentCenterShell.tsx`
- `src/modules/institution/components/SmartFollowUpShell.tsx`
- `src/modules/institution/tests/InstitutionBusinessDomain.test.ts`
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`

修改文件：

- `src/modules/workspace/domain/institution-dashboard.ts`
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
- `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

## 任务 1：补机构业务领域数据

先新增 `InstitutionBusinessDomain.test.ts`，验证以下约束：

- 客户记录数量不少于 5 条。
- 客户记录包含 `id`、姓名、生命周期、优先级、负责人、下一步动作。
- 客户记录不得包含手机号、身份证号、病历号。
- 客户分层包含高意向待承接、术后关怀中、复购窗口期、沉默待激活。
- 预约流转包含待确认、已确认、已到院、改约跟进。
- 随访任务包含客户阶段、截止时间和建议动作。

再新增三个领域文件：

- `customers.ts`：客户分层、客户列表、客户洞察提醒。
- `appointments.ts`：预约流转分组和运营提醒。
- `followups.ts`：随访旅程、随访任务、演示话术建议。

验收命令：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessDomain.test.ts
```

## 任务 2：补三个业务壳组件

新增 `InstitutionBusinessShells.test.tsx`，验证每个壳组件能渲染关键标题和关键业务记录。

实现组件：

- `CustomerCenterShell.tsx`
  - 渲染客户分层指标。
  - 渲染客户优先级队列。
  - 渲染客户数据边界提醒。

- `AppointmentCenterShell.tsx`
  - 渲染预约流转分组。
  - 渲染预约卡片。
  - 渲染爽约风险和档期冲突提醒。

- `SmartFollowUpShell.tsx`
  - 渲染随访旅程概览。
  - 渲染今日随访任务。
  - 渲染演示话术建议。

验收命令：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
```

## 任务 3：接入 `/hospital` 工作台导航

修改 `institution-dashboard.ts`：

- 给每个导航项增加稳定 `id`。
- 定义 `InstitutionViewId` 联合类型。
- 保留工作台为默认激活项。

修改 `InstitutionWorkspace.tsx`：

- 声明为客户端组件。
- 使用 `activeView` 保存当前视图。
- 桌面端侧边栏和移动端横向导航都能切换视图。
- 当前导航项增加激活样式和 `aria-current`。
- `dashboard` 渲染原工作台首页。
- `customers` 渲染客户中心。
- `appointments` 渲染预约中心。
- `followups` 渲染智能随访。
- 其他导航项暂时渲染中文占位说明。

更新工作台测试：

- `WorkspaceDashboardDomain.test.ts` 验证导航 `id` 和默认项。
- `WorkspaceEntryPages.test.tsx` 验证 `/hospital` 默认工作台和点击切换。

验收命令：

```bash
node scripts/run-vitest.mjs run \
  src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts \
  src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

## 任务 4：全量验证

运行以下命令：

```bash
node scripts/run-vitest.mjs run \
  src/modules/institution/tests/InstitutionBusinessDomain.test.ts \
  src/modules/institution/tests/InstitutionBusinessShells.test.tsx \
  src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts \
  src/modules/workspace/tests/WorkspaceEntryPages.test.tsx

./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 任务 5：浏览器验收

启动本地服务：

```bash
node scripts/run-next.mjs dev --webpack --port 5010
```

浏览器检查：

- 打开 `http://localhost:5010/login`。
- 使用演示账号 `admin / admin123` 登录。
- 进入 `/hospital`。
- 点击客户中心，确认出现客户运营、演示客户和客户数据边界。
- 点击预约中心，确认出现预约流转和预约提醒。
- 点击智能随访，确认出现智能随访旅程、今日随访任务和演示话术建议。
- 切到约 `390px` 移动宽度，确认没有横向溢出。

## 已完成结果

本阶段已完成：

- 三个机构业务领域文件。
- 三个机构业务壳组件。
- `/hospital` 页面内导航切换。
- 机构业务域测试、业务壳测试、工作台入口测试。
- 本地提交：`95b2731 Add institution business shells`。

后续又补充了中文文案清理，确保业务壳和登录入口的用户可见文案不再混入英文标题。

## 后续建议

下一阶段如果继续推进真实业务能力，应先进入规划阶段，重点设计：

- 租户隔离。
- 客户资料模型。
- 预约模型。
- 随访任务状态机。
- RBAC 权限。
- 审计日志。
- 敏感信息脱敏与访问控制。

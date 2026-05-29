# 工作台 UI 重设计实施计划

## 目标

将机构端 `/hospital` 改为浅奢医疗增长工作台，将平台端 `/open-platform` 改为深色科技运营中枢，并保持现有登录、退出和演示会话行为不变。

本阶段只改工作台领域静态数据、两个工作台页面组件和测试，不引入数据库、真实权限、开放平台密钥或后端服务。先用测试锁定新的导航、核心文案、指标和能力入口，再实现视觉改造，最后用浏览器验证桌面与移动端基础布局。

## 技术范围

使用现有技术栈：

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react
- Vitest
- Testing Library

## 文件清单

修改文件：

- `src/modules/workspace/domain/institution-dashboard.ts`
- `src/modules/workspace/domain/platform-dashboard.ts`
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
- `src/modules/workspace/components/PlatformConsole.tsx`
- `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- `docs/devlog/2026-05-29.md`

## 任务 1：更新领域测试和静态数据

修改 `WorkspaceDashboardDomain.test.ts`，先锁定新的信息架构：

机构端需要覆盖：

- 导航包含工作台、客户中心、智能随访、客服工作台、预约中心、知识库、数据分析。
- 指标包含累计客户资产、今日待承接、预约转化率、复购窗口客户。
- AI 建议包含复购、转化、服务三类。
- 客户旅程包含新客咨询、预约到院、术后关怀、复购召回。
- 今日行动队列包含 5 条演示客户动作。

平台端需要覆盖：

- 导航包含平台总览、首页与品牌、租户管理、产品与套餐、开放连接中心、权限与审计。
- 指标包含入驻医院、活跃机构、Agent 调用、服务用户、MRR、续费率。
- 能力卡包含开放接口治理、模型与智能体监控、权限审计。

修改领域文件：

- `institution-dashboard.ts` 更新机构端导航、指标、AI 建议、旅程看板、行动队列。
- `platform-dashboard.ts` 更新平台端导航、指标、系统健康状态、能力卡。

验收命令：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

## 任务 2：重设计机构端工作台

修改 `WorkspaceEntryPages.test.tsx`，先验证机构端关键展示：

- 标题包含「让咨询团队」和「先看到增长机会」。
- 页面展示「今日高意向客户 18 位」。
- 页面展示「累计客户资产」。
- 页面展示「客户旅程看板」。
- 页面展示「今日行动队列」。

修改 `InstitutionWorkspace.tsx`：

- 根背景使用 `/homepage/zmtg-luxury-clinic-bg.png`。
- 侧边栏使用深色网格风格。
- 主标题使用「让咨询团队 / 先看到增长机会」。
- 指标卡读取 `institutionStats`。
- AI 建议卡读取 `institutionSuggestions`。
- 客户旅程读取 `institutionJourneyLanes`。
- 今日行动队列读取 `institutionActionQueue`。
- 保持 `LogoutButton redirectTo="/login"` 不变。

验收命令：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

## 任务 3：重设计平台端控制台

修改 `WorkspaceEntryPages.test.tsx`，验证平台端关键展示：

- 标题包含「掌控租户、模型与接口」。
- 页面展示平台核心指标。
- 页面展示系统健康状态。
- 页面展示开放接口治理、模型与智能体监控、权限审计。

修改 `PlatformConsole.tsx`：

- 使用深色科技控制台背景。
- 保留平台管理员身份区域和退出按钮。
- 渲染六个核心平台指标。
- 渲染平台增长与调用趋势。
- 渲染系统健康状态。
- 渲染三个治理能力卡片。

验收命令：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

## 任务 4：全量验证和浏览器验收

运行：

```bash
./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

浏览器验收：

- 启动 `node scripts/run-next.mjs dev --webpack --port 5010`。
- 打开 `/login`，登录后确认 `/hospital` 的机构端视觉和移动端排版。
- 打开 `/platform-login`，登录后确认 `/open-platform` 的平台端视觉和移动端排版。
- 检查没有明显文字重叠、卡片溢出或横向滚动问题。

## 任务 5：开发日志和 PR 更新

更新 `docs/devlog/2026-05-29.md`，记录：

- 机构端 UI 改造范围。
- 平台端 UI 改造范围。
- 测试、构建和浏览器验收结果。
- 风险：只改视觉和静态演示数据，不涉及真实数据服务。

提交前确认：

- 工作区只包含本阶段相关文件。
- 测试和构建通过。
- 没有改动数据库、生产配置、真实认证、真实开放平台能力。

## 已完成结果

该计划对应的工作台 UI 重设计阶段已完成，后续机构端业务壳阶段在此视觉基础上继续扩展。后续计划文档应继续使用中文标题和中文说明，代码路径、命令和类型名保持原文。

# 模块边界

## 依赖方向

```text
src/app
  ↓
src/modules
  ↓
src/server 与 src/shared
```

## 基本规则

1. `src/app` 只负责路由、页面组合和请求入口。
2. `src/modules` 承载业务领域、服务、模块组件和模块测试。
3. `src/shared` 只保存真正跨多个模块复用的能力。
4. `src/server` 保存数据库、认证、上下文、日志和存储等基础设施。
5. 业务模块不得依赖 `src/app`。
6. Domain 层不得依赖 React 页面组件。
7. 机构端页面不得直接依赖平台端页面。
8. 平台端页面不得直接依赖机构端页面。
9. 随访业务不得直接调用企业微信 SDK。
10. 外部渠道必须经过统一连接器或消息投递边界。

## 目标业务模块

```text
src/modules/
├── customers/
├── appointments/
├── treatments/
├── followups/
├── opportunities/
├── knowledge/
├── conversations/
├── auth/
├── tenants/
├── rbac/
├── audit/
├── branding/
├── analytics/
└── entitlements/
```

这是目标方向，不代表本轮立即创建或移动全部源码。

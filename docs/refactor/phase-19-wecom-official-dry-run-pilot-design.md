# 第十九阶段：WeCom official dry-run API 单一路由族试点设计

- 日期：2026-07-26
- 分支：`docs/wecom-dry-run-version-pilot-design-20260726-185158`
- 基线：`d7a5d27a992a0f2dc3e945109ce28835a6870573`
- 当前入口：`/api/institution/wecom-official-dry-run`
- 建议目标：`/api/v1/institution/wecom-official-dry-run`
- 当前风险：`high`
- 阶段性质：docs-only
- API 修改：0
- 运行时行为修改：0

## 目标

只为 `/api/institution/wecom-official-dry-run` 设计一个可独立回退的版本化兼容入口。本阶段不创建目标路由、不修改旧路由、不修改调用方。

## 当前锁定契约

| 维度 | 必须保持 |
|---|---|
| HTTP method | `GET` |
| HTTP status | `503` |
| payload.code | `capability_disabled` |
| payload.error | `企业微信官方 dry-run 能力当前未启用` |
| Cache-Control | `no-store` |
| Request 读取 | 0 |
| 下游初始化或调用 | 0 |
| 数据库访问 | 0 |
| 外部网络调用 | 0 |
| 敏感数据读取 | 0 |

## 架构决策

第二十阶段新增版本化只读别名，不抽取共享 Handler，不修改旧入口。目标路由必须只包含：

```ts
export { GET } from '@/app/api/institution/wecom-official-dry-run/route';
```

新旧入口共享同一个 `GET` 函数引用，不增加 Wrapper、重定向、代理、Header 或 Request 读取。

## 调用方结论

仓库内页面、组件、运行时代码和脚本调用方均为 0。现有 3 个测试引用继续保持不变。仓库外客户端、网关和集成系统仍按未知调用方处理，因此旧入口不得设置 sunset 日期。

## 第二十阶段精确白名单

1. `src/app/api/v1/institution/wecom-official-dry-run/route.ts`
2. `src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`
3. `docs/handoff/CURRENT_STATUS.md`
4. `docs/handoff/NEXT_TASK.md`
5. `docs/handoff/RELEASE_HISTORY.md`

旧路由和现有测试均为只读依赖，不得修改。

## 新测试要求

1. 新旧 `GET` 为同一函数引用；
2. 两个入口返回完全相同的 status、JSON 和 Cache-Control；
3. hostile Request Proxy 对新入口保持零 trap；
4. 新路由源码只有一条 re-export；
5. 旧路由和现有测试无 diff；
6. build 同时列出新旧两个入口。

## 兼容期与退役

第二十阶段不允许退役旧入口，不增加 Deprecation 或 Sunset Header。未来只有在已知调用方迁移完成、外部未知调用通过观测降低、旧入口无有效流量并获得单独授权后，才可讨论退役。

## 回退

回退只需删除新增目标路由和新增测试，并恢复 3 个交接文件。旧入口从未修改，不需要恢复 API、数据库或调用方。

## 禁止范围

- 不修改 `src/app/api/institution/wecom-official-dry-run/route.ts`；
- 不修改任何现有测试或调用方；
- 不新增 Wrapper、重定向或代理；
- 不扩大到 `/evaluate`、config、snapshot 或其他路由；
- 不修改迁移矩阵、Schema、Migration、package 或锁文件；
- 不连接数据库或真实外部服务；
- 不扩大到第二个路由族。

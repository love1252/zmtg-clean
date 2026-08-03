# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 第一批低风险正式 Route Guard capability-off 接线实施
```

## 冻结范围

第一批 Route：`['src/app/api/institution/entitlement-usage/route.ts', 'src/app/api/institution/knowledge-management/ai-call/usage/route.ts', 'src/app/api/institution/knowledge-management/retrieval/route.ts', 'src/app/api/institution/knowledge-management/search/route.ts', 'src/app/api/institution/knowledge-management/vector-search/route.ts']`

涉及 section：`['knowledge', 'system']`

实施 allowlist：`12` 个文件。

## 任务目标

1. 新增统一 institution Route Guard 薄接线；
2. 每个 Route 先解析 genuine request authorization；
3. 每个 Route 执行对应 Section Guard；
4. 拒绝时原 handler、数据库和外部调用均为 0；
5. 允许时既有 handler 只执行一次；
6. 保持成功响应、业务查询和缓存 contract 不变；
7. 完成 Route 定向测试、架构门禁、lint、typecheck 和 build。

## 禁止范围

- 不接入业务对象 Reader，不开放新的业务 Capability；
- 不修改非 allowlist 文件；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 dynamic object Route、写 Route、凭证、HIS、上传下载或外部触达；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。

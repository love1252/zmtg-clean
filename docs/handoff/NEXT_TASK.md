# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B3 正式 Session／上下文刷新及三类 revision 实时重读前置预检
```

## 任务目标

1. 冻结正式登录、Session 创建／恢复／刷新和每请求上下文构建入口；
2. 核验每次授权实时重读 Membership revision；
3. 核验每次授权实时重读 Binding version／status／expiresAt；
4. 核验每次授权实时重读 Scope revision／status；
5. cookie、Session claim、缓存和 transition evidence 不得成为授权 current；
6. 冻结 stale revision、过期 Binding、多 Membership、缺 Scope 的 fail-closed 矩阵；
7. 形成精确 Runtime allowlist、测试范围和独立审查门禁。

## 禁止范围

- 本预检不修改 Runtime、Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B4～B6；
- 不放行项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

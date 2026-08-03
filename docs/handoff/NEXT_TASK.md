# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B3 正式 Session／上下文刷新及三类 revision 实时重读契约关闭证据
```

## 任务目标

1. 冻结前置预检与独立审查证据；
2. 汇总正式登录、Session 恢复和每请求授权三类入口；
3. 固化 Membership、Binding 与 Scope 三个独立 revision 域实时重读证明；
4. 固化 cookie／claims selector-only 和无第二授权 current 证明；
5. 固化 stale、过期、撤销、多 Membership、缺 Scope 的 fail-closed 矩阵；
6. 形成 BASE-B3 完整关闭清单与独立审查；
7. handoff 后才允许进入 BASE-B4 入口／业务／对象 Guard 前置预检。

## 禁止范围

- 不制造无意义 Runtime 修改；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不在关闭证据 PR 内启动 BASE-B4～B6；
- 不放行项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

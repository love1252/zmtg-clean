# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 入口／业务／对象 Guard 与绕过闭环前置预检
```

## 任务目标

1. 盘点机构端正式 API、Server Action、Server Runtime 与后台任务入口；
2. 冻结入口级 Guard、业务动作 Guard 与对象／资源级 Guard 的职责边界；
3. 核验每个受保护入口必须消费 genuine request authorization，不能信任客户端 role、tenant、institution 或 capability；
4. 审计 Owner 外数据库／Repository 直读、绕过 Guard 的调用链和 demo／formal 混用；
5. 冻结 action／section／object policy、拒绝码和 fail-closed 矩阵；
6. 形成精确 Runtime 实施 allowlist、定向测试范围和架构门禁；
7. 前置预检和独立审查完成后才允许进入 BASE-B4 实施或关闭证据。

## 禁止范围

- 本前置预检不修改 Runtime、Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6；
- 不放行项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

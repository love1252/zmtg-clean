# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 Action Policy／Object Guard capability-off 核心实施
```

## 任务目标

1. 按 `B4_G1_capability_off_object_action_guard` 路径实施；
2. 新增业务 Owner 对象事实的版本化低敏消费 Port；
3. 新增注册表驱动的 Action Policy；
4. 新增只接受 genuine request authorization 与 genuine object fact 的 Object Guard；
5. 扩展 request authorization 与 institution runtime；
6. 未接业务 Owner Adapter 时保持 capability-off 和 fail-closed；
7. 完成 10 文件范围内的定向测试和架构门禁。

## 禁止范围

- 不修改业务 Owner 模块、业务 Route或业务 Reader；
- 不开放真实业务 Capability；
- 不修改 Schema、Migration、journal、snapshot、Seed 或 script；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。

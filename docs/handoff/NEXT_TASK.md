# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 剩余正式 Route 再校准与第二批低风险 Route Guard 前置预检
```

## 任务目标

1. 以第一批合并后的 main 重新扫描机构端正式 Route；
2. 从原 73 个正式候选中排除已完成的第一批 5 个 Route；
3. 重新核对 HTTP method、动态对象、数据库直读、demo signal、外部触达和现有 formal Guard；
4. 第二批仍优先选择 GET-only、非动态对象、无直接数据库和无业务对象 Reader 的低风险 Route；
5. 冻结每个 Route 的 section、Guard 链、成功响应 contract 与拒绝响应；
6. 冻结生产文件、测试文件和必要兼容性测试的精确 allowlist；
7. 前置预检和独立审查完成后才允许实施第二批接线。

## 经验固化

- 共享 Route Guard 保持在 `src/app/api/institution/_shared`；
- 不向冻结的 `src/modules/institution` 增加生产文件；
- 实施前必须把既有 handler-contract 回归测试纳入影响面；
- 本地门禁必须包含完整 `pnpm test`，不能只运行新增定向测试。

## 禁止范围

- 不开放业务 Reader 或新业务 Capability；
- 不处理动态对象 Route、写 Route、凭证、HIS、上传下载或外部触达；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。

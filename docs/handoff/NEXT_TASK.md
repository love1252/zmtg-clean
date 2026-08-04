# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 剩余 capability-off 正式 Route 第四批精确校准前置预检
```

## 判定来源

```text
corrected_owner_outside_direct_writer_count=0
corrected_lifecycle_unresolved_count=0
route_review_candidate_count_provisional=56
capability_off_unwired_count_provisional=52
base_b4_complete=false
base_b5_started=false
```

## 任务目标

1. 从最新 main 重新枚举 institution 与 v1 institution Route；
2. 排除测试夹具、治理工具、纯字符串和 UI 文案误报；
3. 排除 versioned re-export、legacy／retired、dynamic object、
   write／mixed method、direct DB、demo／fixture、external touch；
4. 排除凭证、HIS、上传下载、解析、索引、真实触达等高风险路径；
5. 排除已有独立 formal Guard 的入口；
6. 只冻结真正 GET-only、非动态、无数据库、无外部调用、
   capability-off 的第四批候选；
7. 扫描直接与传递兼容性测试、生产调用面；
8. 形成精确 implementation allowlist，并经独立审查后再实施。

## 当前说明

上一轮 `52` 个 capability-off unwired 是宽口径临时扫描结果，
不代表 52 个生产缺陷，也不构成批量实施授权。

## 禁止范围

- 本任务先做校准、CSV、Markdown 和独立审查；
- 不修改生产 Runtime、Route、Guard 或业务模块；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不启动 BASE-B5，不处理 historical orphan；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability。

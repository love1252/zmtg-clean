# API 版本化方案

## 当前问题

仓库中存在以下 API 路径形式：

```text
/api/institution/*
/api/v1/institution/*
/api/open-platform/*
/api/v1/open-platform/*
```

## 建议目标

```text
/api/v1/platform/*
/api/v1/tenant/*
/api/v1/public/*
/api/webhooks/*
```

## 迁移要求

1. 第一阶段只建立清单，不改变现有 API。
2. 每个旧路径必须确认调用方和测试覆盖。
3. 迁移期间可保留兼容转发。
4. Webhook 不与普通业务 API 混合。
5. API 路径调整必须使用单独 PR。

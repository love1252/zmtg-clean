#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  open,
  realpath,
  stat,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

export const S11_TASK = 'POST_V2_R1C_AUDIT_WRITER_HISTORICAL_BACKFILL';
export const S11_BASELINE = '5dedc54da98ee5a028216980049e245807630150';
export const MANIFEST_VERSION = 'post-v2-r1c-audit-historical-backfill/v1';

const ALLOWED_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;

export class S11BackfillError extends Error {
  constructor(code) {
    super(code);
    this.name = 'S11BackfillError';
    this.code = code;
  }
}

function fail(code) {
  throw new S11BackfillError(code);
}

function freezeRule(rule) {
  return Object.freeze({
    ...rule,
    DML_REQUIRED: rule.DML_REQUIRED === true,
    ROLLBACK_METHOD:
      'repo 外 0600 manifest + exact event_id + expected-new-state precondition，仅恢复 attribution 两列',
  });
}

export const CLASSIFICATION_RULES = Object.freeze([
  freezeRule({
    RULE_ID: 'R-PRESERVE-VERIFIED',
    TARGET_CLASS: 'VERIFIED',
    MATCH_PREDICATE:
      "institution_attribution='verified' AND tenant_id IS NOT NULL AND institution_id IS NOT NULL",
    EVIDENCE: 'S8 canonical verified persistence shape',
    WHY_SAFE: '已合法归因记录只读保留，不覆盖、不回填',
    DML_REQUIRED: false,
  }),
  freezeRule({
    RULE_ID: 'R-PRESERVE-NOT-APPLICABLE',
    TARGET_CLASS: 'NOT_APPLICABLE',
    MATCH_PREDICATE:
      "institution_attribution='not_applicable' AND institution_id IS NULL",
    EVIDENCE: 'S8 canonical not_applicable persistence shape',
    WHY_SAFE: '已合法归因记录只读保留，不覆盖、不回填',
    DML_REQUIRED: false,
  }),
  freezeRule({
    RULE_ID: 'R-VERIFIED-MAPPING-OPERATION',
    TARGET_CLASS: 'VERIFIED',
    MATCH_PREDICATE:
      'legacy NULL/NULL + exact tenant/customer + decided_at + decided_by + reason/status unique mapping operation',
    EVIDENCE: 'wecom_customer_mapping_states 同一历史 operation 持久化 pair',
    WHY_SAFE: '稳定 customer id、operation timestamp、actor 与 transition status 唯一吻合',
    DML_REQUIRED: true,
  }),
  freezeRule({
    RULE_ID: 'R-VERIFIED-CONSENT-OPERATION',
    TARGET_CLASS: 'VERIFIED',
    MATCH_PREDICATE:
      'legacy NULL/NULL + exact tenant/customer + recorded_at + recorded_by + reason/status unique consent operation',
    EVIDENCE: 'customer_channel_contact_consents 同一历史 operation 持久化 pair',
    WHY_SAFE: '稳定 customer id、operation timestamp、actor 与 consent status 唯一吻合',
    DML_REQUIRED: true,
  }),
  freezeRule({
    RULE_ID: 'R-VERIFIED-FREQUENCY-OPERATION',
    TARGET_CLASS: 'VERIFIED',
    MATCH_PREDICATE:
      "legacy NULL/NULL + frequency_reserved transitioned + exact tenant/customer/window_started_at unique operation",
    EVIDENCE: 'customer_channel_frequency_states 同一历史 window creation 持久化 pair',
    WHY_SAFE: '只接受不可变 window 起点的唯一 persisted operation；blocked/current-state 不反推',
    DML_REQUIRED: true,
  }),
  freezeRule({
    RULE_ID: 'R-VERIFIED-DRY-RUN-OPERATION',
    TARGET_CLASS: 'VERIFIED',
    MATCH_PREDICATE:
      'legacy NULL/NULL + exact evaluated_at + evaluated_by + result/preflight unique dry-run operation',
    EVIDENCE: 'institution_channel_dry_run_snapshots 同一历史 evaluation 持久化 pair',
    WHY_SAFE: 'operation timestamp、actor 与 result/status 唯一吻合',
    DML_REQUIRED: true,
  }),
  freezeRule({
    RULE_ID: 'R-VERIFIED-DRAFT-CREATION',
    TARGET_CLASS: 'VERIFIED',
    MATCH_PREDICATE:
      'legacy NULL/NULL + message_draft_created + exact tenant/draft id/created_at unique operation',
    EVIDENCE: 'follow_up_message_drafts 创建 operation 持久化 pair',
    WHY_SAFE: '稳定 draft primary key 与创建时点唯一吻合',
    DML_REQUIRED: true,
  }),
  freezeRule({
    RULE_ID: 'R-VERIFIED-DELIVERY-TIMELINE',
    TARGET_CLASS: 'VERIFIED',
    MATCH_PREDICATE:
      'legacy NULL/NULL + exact delivery id/suffix/occurred_at/reason/actor-role unique timeline evidence',
    EVIDENCE: 'follow_up_customer_timeline_events 同一历史 delivery operation 持久化 pair',
    WHY_SAFE: '稳定 delivery id、operation suffix、timestamp、reason 与 actor role 唯一吻合',
    DML_REQUIRED: true,
  }),
  freezeRule({
    RULE_ID: 'R-NOT-APPLICABLE-AUTH-LOGIN',
    TARGET_CLASS: 'NOT_APPLICABLE',
    MATCH_PREDICATE:
      'legacy NULL/NULL + exact formal tenant login tuple (tenant_member/read_own_tenant/server_session)',
    EVIDENCE: '历史 Auth login contract 明确是 tenant membership session，不属于单一 institution',
    WHY_SAFE: '业务语义本身证明 institution 不适用；未知归属不参与规则',
    DML_REQUIRED: true,
  }),
  freezeRule({
    RULE_ID: 'R-UNCLASSIFIABLE-FALLBACK',
    TARGET_CLASS: 'UNCLASSIFIABLE',
    MATCH_PREDICATE: '未唯一命中以上 canonical shape 或 Grade A/B 历史 operation 证据',
    EVIDENCE: '证据不足或 shape 非 canonical',
    WHY_SAFE: '保持 attribution 原状态，不猜测，不写 legacy_unattributed',
    DML_REQUIRED: false,
  }),
]);

const RULE_BY_ID = new Map(CLASSIFICATION_RULES.map((rule) => [rule.RULE_ID, rule]));

const SNAPSHOT_SELECT = String.raw`
SELECT
  a.event_id,
  a.actor_id,
  a.actor_role::text AS actor_role,
  a.tenant_id,
  a.institution_id,
  a.institution_attribution::text AS institution_attribution,
  a.scope,
  a.resource,
  a.resource_id,
  a.action,
  a.result::text AS result,
  a.reason,
  a.occurred_at,
  a.source,
  (
    SELECT count(*)::int
    FROM wecom_customer_mapping_states s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.decided_at = a.occurred_at
      AND s.decided_by = a.actor_id
      AND (
        (a.reason = 'wecom_customer_mapping_confirmed' AND s.status = 'confirmed')
        OR (a.reason = 'wecom_customer_mapping_rejected' AND s.status = 'rejected')
        OR (a.reason = 'wecom_customer_mapping_revoked' AND s.status = 'revoked')
      )
  ) AS mapping_match_count,
  (
    SELECT count(DISTINCT s.institution_id)::int
    FROM wecom_customer_mapping_states s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.decided_at = a.occurred_at
      AND s.decided_by = a.actor_id
      AND (
        (a.reason = 'wecom_customer_mapping_confirmed' AND s.status = 'confirmed')
        OR (a.reason = 'wecom_customer_mapping_rejected' AND s.status = 'rejected')
        OR (a.reason = 'wecom_customer_mapping_revoked' AND s.status = 'revoked')
      )
  ) AS mapping_institution_count,
  (
    SELECT min(s.institution_id)
    FROM wecom_customer_mapping_states s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.decided_at = a.occurred_at
      AND s.decided_by = a.actor_id
      AND (
        (a.reason = 'wecom_customer_mapping_confirmed' AND s.status = 'confirmed')
        OR (a.reason = 'wecom_customer_mapping_rejected' AND s.status = 'rejected')
        OR (a.reason = 'wecom_customer_mapping_revoked' AND s.status = 'revoked')
      )
  ) AS mapping_institution_id,
  (
    SELECT count(*)::int
    FROM customer_channel_contact_consents s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.recorded_at = a.occurred_at
      AND s.recorded_by = a.actor_id
      AND (
        (a.reason = 'wecom_reachout_consent_recorded' AND s.status = 'consented')
        OR (a.reason = 'wecom_reachout_opt_out_recorded' AND s.status = 'opted_out')
        OR (a.reason = 'wecom_reachout_consent_revoked' AND s.status = 'consent_revoked')
      )
  ) AS consent_match_count,
  (
    SELECT count(DISTINCT s.institution_id)::int
    FROM customer_channel_contact_consents s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.recorded_at = a.occurred_at
      AND s.recorded_by = a.actor_id
      AND (
        (a.reason = 'wecom_reachout_consent_recorded' AND s.status = 'consented')
        OR (a.reason = 'wecom_reachout_opt_out_recorded' AND s.status = 'opted_out')
        OR (a.reason = 'wecom_reachout_consent_revoked' AND s.status = 'consent_revoked')
      )
  ) AS consent_institution_count,
  (
    SELECT min(s.institution_id)
    FROM customer_channel_contact_consents s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.recorded_at = a.occurred_at
      AND s.recorded_by = a.actor_id
      AND (
        (a.reason = 'wecom_reachout_consent_recorded' AND s.status = 'consented')
        OR (a.reason = 'wecom_reachout_opt_out_recorded' AND s.status = 'opted_out')
        OR (a.reason = 'wecom_reachout_consent_revoked' AND s.status = 'consent_revoked')
      )
  ) AS consent_institution_id,
  (
    SELECT count(*)::int
    FROM customer_channel_frequency_states s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.window_started_at = a.occurred_at
      AND a.reason = 'wecom_reachout_frequency_reserved'
      AND a.result = 'transitioned'
  ) AS frequency_match_count,
  (
    SELECT count(DISTINCT s.institution_id)::int
    FROM customer_channel_frequency_states s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.window_started_at = a.occurred_at
      AND a.reason = 'wecom_reachout_frequency_reserved'
      AND a.result = 'transitioned'
  ) AS frequency_institution_count,
  (
    SELECT min(s.institution_id)
    FROM customer_channel_frequency_states s
    WHERE s.tenant_id = a.tenant_id
      AND s.customer_id = a.resource_id
      AND s.window_started_at = a.occurred_at
      AND a.reason = 'wecom_reachout_frequency_reserved'
      AND a.result = 'transitioned'
  ) AS frequency_institution_id,
  (
    SELECT count(*)::int
    FROM institution_channel_dry_run_snapshots s
    WHERE s.tenant_id = a.tenant_id
      AND s.evaluated_at = a.occurred_at
      AND s.evaluated_by = a.actor_id
      AND (
        (a.reason = 'wecom_reachout_dry_run_snapshot_ready' AND a.result = 'transitioned' AND s.preflight_status = 'mock_ready')
        OR (a.reason = 'wecom_reachout_dry_run_snapshot_blocked' AND a.result = 'denied' AND s.preflight_status <> 'mock_ready')
      )
  ) AS dry_run_match_count,
  (
    SELECT count(DISTINCT s.institution_id)::int
    FROM institution_channel_dry_run_snapshots s
    WHERE s.tenant_id = a.tenant_id
      AND s.evaluated_at = a.occurred_at
      AND s.evaluated_by = a.actor_id
      AND (
        (a.reason = 'wecom_reachout_dry_run_snapshot_ready' AND a.result = 'transitioned' AND s.preflight_status = 'mock_ready')
        OR (a.reason = 'wecom_reachout_dry_run_snapshot_blocked' AND a.result = 'denied' AND s.preflight_status <> 'mock_ready')
      )
  ) AS dry_run_institution_count,
  (
    SELECT min(s.institution_id)
    FROM institution_channel_dry_run_snapshots s
    WHERE s.tenant_id = a.tenant_id
      AND s.evaluated_at = a.occurred_at
      AND s.evaluated_by = a.actor_id
      AND (
        (a.reason = 'wecom_reachout_dry_run_snapshot_ready' AND a.result = 'transitioned' AND s.preflight_status = 'mock_ready')
        OR (a.reason = 'wecom_reachout_dry_run_snapshot_blocked' AND a.result = 'denied' AND s.preflight_status <> 'mock_ready')
      )
  ) AS dry_run_institution_id,
  (
    SELECT count(*)::int
    FROM follow_up_message_drafts d
    WHERE d.tenant_id = a.tenant_id
      AND d.id = a.resource_id
      AND d.institution_id IS NOT NULL
      AND d.created_at = a.occurred_at
      AND a.reason = 'message_draft_created'
      AND a.result = 'allowed'
  ) AS draft_match_count,
  (
    SELECT count(DISTINCT d.institution_id)::int
    FROM follow_up_message_drafts d
    WHERE d.tenant_id = a.tenant_id
      AND d.id = a.resource_id
      AND d.institution_id IS NOT NULL
      AND d.created_at = a.occurred_at
      AND a.reason = 'message_draft_created'
      AND a.result = 'allowed'
  ) AS draft_institution_count,
  (
    SELECT min(d.institution_id)
    FROM follow_up_message_drafts d
    WHERE d.tenant_id = a.tenant_id
      AND d.id = a.resource_id
      AND d.institution_id IS NOT NULL
      AND d.created_at = a.occurred_at
      AND a.reason = 'message_draft_created'
      AND a.result = 'allowed'
  ) AS draft_institution_id,
  (
    SELECT count(*)::int
    FROM follow_up_customer_timeline_events t
    WHERE t.tenant_id = a.tenant_id
      AND t.institution_id IS NOT NULL
      AND t.source_id = a.resource_id || CASE a.reason
        WHEN 'message_delivery_created' THEN ':created'
        WHEN 'message_delivery_mock_sent' THEN ':mock_sent'
        ELSE ':not-a-delivery-rule'
      END
      AND t.occurred_at = a.occurred_at
      AND t.safe_reason_code = a.reason
      AND (t.safe_actor_role IS NULL OR t.safe_actor_role = a.actor_role::text)
      AND a.reason IN ('message_delivery_created', 'message_delivery_mock_sent')
      AND a.result = 'allowed'
  ) AS delivery_match_count,
  (
    SELECT count(DISTINCT t.institution_id)::int
    FROM follow_up_customer_timeline_events t
    WHERE t.tenant_id = a.tenant_id
      AND t.institution_id IS NOT NULL
      AND t.source_id = a.resource_id || CASE a.reason
        WHEN 'message_delivery_created' THEN ':created'
        WHEN 'message_delivery_mock_sent' THEN ':mock_sent'
        ELSE ':not-a-delivery-rule'
      END
      AND t.occurred_at = a.occurred_at
      AND t.safe_reason_code = a.reason
      AND (t.safe_actor_role IS NULL OR t.safe_actor_role = a.actor_role::text)
      AND a.reason IN ('message_delivery_created', 'message_delivery_mock_sent')
      AND a.result = 'allowed'
  ) AS delivery_institution_count,
  (
    SELECT min(t.institution_id)
    FROM follow_up_customer_timeline_events t
    WHERE t.tenant_id = a.tenant_id
      AND t.institution_id IS NOT NULL
      AND t.source_id = a.resource_id || CASE a.reason
        WHEN 'message_delivery_created' THEN ':created'
        WHEN 'message_delivery_mock_sent' THEN ':mock_sent'
        ELSE ':not-a-delivery-rule'
      END
      AND t.occurred_at = a.occurred_at
      AND t.safe_reason_code = a.reason
      AND (t.safe_actor_role IS NULL OR t.safe_actor_role = a.actor_role::text)
      AND a.reason IN ('message_delivery_created', 'message_delivery_mock_sent')
      AND a.result = 'allowed'
  ) AS delivery_institution_id
FROM audit_events a
`;

const SCHEMA_FINGERPRINT_SQL = String.raw`
SELECT 'column' AS kind, column_name AS name, data_type AS value, udt_name AS detail, is_nullable AS nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_events'
UNION ALL
SELECT 'enum' AS kind, e.enumlabel AS name, t.typname AS value, e.enumsortorder::text AS detail, 'NO' AS nullable
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname IN ('audit_institution_attribution', 'audit_result')
ORDER BY kind, name, detail
`;

function numberField(row, name) {
  const value = Number(row[name] ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) fail('invalid_evidence_count');
  return value;
}

function isUniquePairEvidence(row, prefix) {
  const institutionId = row[`${prefix}_institution_id`];
  return (
    numberField(row, `${prefix}_match_count`) === 1 &&
    numberField(row, `${prefix}_institution_count`) === 1 &&
    typeof institutionId === 'string' &&
    institutionId.length > 0
  );
}

function normalizeTimestamp(value) {
  const result = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  if (result === 'Invalid Date') fail('invalid_occurred_at');
  return result;
}

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function immutableAuditEventDigest(row) {
  return sha256(canonicalJson({
    eventId: row.event_id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    tenantId: row.tenant_id,
    scope: row.scope,
    resource: row.resource,
    resourceId: row.resource_id,
    action: row.action,
    result: row.result,
    reason: row.reason,
    occurredAt: normalizeTimestamp(row.occurred_at),
    source: row.source,
  }));
}

function increment(map, key) {
  map.set(key ?? '<null>', (map.get(key ?? '<null>') ?? 0) + 1);
}

function sortedRecord(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function buildLowSensitiveAggregates(rows) {
  const tenant = new Map();
  const resource = new Map();
  const action = new Map();
  const result = new Map();
  const reason = new Map();
  const source = new Map();
  const timestamps = [];
  for (const row of rows) {
    increment(tenant, row.tenant_id);
    increment(resource, row.resource);
    increment(action, row.action);
    increment(result, row.result);
    increment(reason, row.reason);
    increment(source, row.source);
    timestamps.push(normalizeTimestamp(row.occurred_at));
  }
  timestamps.sort();
  return {
    tenantCount: tenant.size,
    tenantRowCounts: [...tenant.values()].sort((left, right) => right - left),
    resource: sortedRecord(resource),
    action: sortedRecord(action),
    result: sortedRecord(result),
    reason: sortedRecord(reason),
    source: sortedRecord(source),
    timeRange: {
      from: timestamps[0] ?? null,
      to: timestamps.at(-1) ?? null,
    },
  };
}

function loginTupleMatches(row) {
  if (
    row.tenant_id === null ||
    row.resource !== 'tenant_member' ||
    row.action !== 'read_own_tenant' ||
    row.source !== 'server_session'
  ) return false;
  return (
    (row.reason === 'tenant_login_succeeded' && row.result === 'allowed') ||
    (row.reason === 'tenant_login_failed' && row.result === 'denied')
  );
}

function candidateRulesForLegacyRow(row) {
  const candidates = [];
  if (isUniquePairEvidence(row, 'mapping')) {
    candidates.push({
      ruleId: 'R-VERIFIED-MAPPING-OPERATION',
      targetClass: 'VERIFIED',
      institutionId: row.mapping_institution_id,
    });
  }
  if (isUniquePairEvidence(row, 'consent')) {
    candidates.push({
      ruleId: 'R-VERIFIED-CONSENT-OPERATION',
      targetClass: 'VERIFIED',
      institutionId: row.consent_institution_id,
    });
  }
  if (isUniquePairEvidence(row, 'frequency')) {
    candidates.push({
      ruleId: 'R-VERIFIED-FREQUENCY-OPERATION',
      targetClass: 'VERIFIED',
      institutionId: row.frequency_institution_id,
    });
  }
  if (isUniquePairEvidence(row, 'dry_run')) {
    candidates.push({
      ruleId: 'R-VERIFIED-DRY-RUN-OPERATION',
      targetClass: 'VERIFIED',
      institutionId: row.dry_run_institution_id,
    });
  }
  if (isUniquePairEvidence(row, 'draft')) {
    candidates.push({
      ruleId: 'R-VERIFIED-DRAFT-CREATION',
      targetClass: 'VERIFIED',
      institutionId: row.draft_institution_id,
    });
  }
  if (isUniquePairEvidence(row, 'delivery')) {
    candidates.push({
      ruleId: 'R-VERIFIED-DELIVERY-TIMELINE',
      targetClass: 'VERIFIED',
      institutionId: row.delivery_institution_id,
    });
  }
  if (loginTupleMatches(row)) {
    candidates.push({
      ruleId: 'R-NOT-APPLICABLE-AUTH-LOGIN',
      targetClass: 'NOT_APPLICABLE',
      institutionId: null,
    });
  }
  return candidates;
}

function unclassifiable(row, overlapRuleIds = []) {
  return {
    eventId: row.event_id,
    beforeInstitutionId: row.institution_id,
    beforeAttribution: row.institution_attribution,
    targetInstitutionId: row.institution_id,
    targetAttribution: row.institution_attribution,
    targetClass: 'UNCLASSIFIABLE',
    ruleId: 'R-UNCLASSIFIABLE-FALLBACK',
    overlapRuleIds,
    dmlRequired: false,
    immutableDigest: immutableAuditEventDigest(row),
  };
}

export function classifySnapshotRows(rows) {
  const entries = [];
  let overlapCount = 0;
  const seen = new Set();
  for (const row of rows) {
    if (typeof row.event_id !== 'string' || row.event_id.length === 0 || seen.has(row.event_id)) {
      fail('invalid_or_duplicate_event_id');
    }
    seen.add(row.event_id);
    const beforeInstitutionId = row.institution_id ?? null;
    const beforeAttribution = row.institution_attribution ?? null;
    if (
      beforeAttribution === 'verified' &&
      typeof row.tenant_id === 'string' && row.tenant_id.length > 0 &&
      typeof beforeInstitutionId === 'string' && beforeInstitutionId.length > 0
    ) {
      entries.push({
        eventId: row.event_id,
        beforeInstitutionId,
        beforeAttribution,
        targetInstitutionId: beforeInstitutionId,
        targetAttribution: 'verified',
        targetClass: 'VERIFIED',
        ruleId: 'R-PRESERVE-VERIFIED',
        overlapRuleIds: [],
        dmlRequired: false,
        immutableDigest: immutableAuditEventDigest(row),
      });
      continue;
    }
    if (beforeAttribution === 'not_applicable' && beforeInstitutionId === null) {
      entries.push({
        eventId: row.event_id,
        beforeInstitutionId,
        beforeAttribution,
        targetInstitutionId: null,
        targetAttribution: 'not_applicable',
        targetClass: 'NOT_APPLICABLE',
        ruleId: 'R-PRESERVE-NOT-APPLICABLE',
        overlapRuleIds: [],
        dmlRequired: false,
        immutableDigest: immutableAuditEventDigest(row),
      });
      continue;
    }
    if (beforeInstitutionId !== null || beforeAttribution !== null) {
      entries.push(unclassifiable(row));
      continue;
    }
    const candidates = candidateRulesForLegacyRow(row);
    if (candidates.length > 1) {
      overlapCount += 1;
      entries.push(unclassifiable(row, candidates.map((candidate) => candidate.ruleId)));
      continue;
    }
    if (candidates.length === 0) {
      entries.push(unclassifiable(row));
      continue;
    }
    const [candidate] = candidates;
    entries.push({
      eventId: row.event_id,
      beforeInstitutionId: null,
      beforeAttribution: null,
      targetInstitutionId: candidate.institutionId,
      targetAttribution: candidate.targetClass === 'VERIFIED' ? 'verified' : 'not_applicable',
      targetClass: candidate.targetClass,
      ruleId: candidate.ruleId,
      overlapRuleIds: [],
      dmlRequired: true,
      immutableDigest: immutableAuditEventDigest(row),
    });
  }
  entries.sort((left, right) => left.eventId.localeCompare(right.eventId));
  const classCounts = {
    VERIFIED: 0,
    NOT_APPLICABLE: 0,
    ATTEMPTED_DENIAL: 0,
    UNCLASSIFIABLE: 0,
  };
  const ruleCounts = Object.fromEntries(CLASSIFICATION_RULES.map((rule) => [rule.RULE_ID, 0]));
  for (const entry of entries) {
    classCounts[entry.targetClass] += 1;
    ruleCounts[entry.ruleId] += 1;
  }
  return { entries, classCounts, ruleCounts, overlapCount };
}

function rawPreCounts(rows) {
  return {
    total: rows.length,
    verified: rows.filter((row) => row.institution_attribution === 'verified').length,
    notApplicable: rows.filter((row) => row.institution_attribution === 'not_applicable').length,
    attemptedDenial: 0,
    unattributed: rows.filter((row) => row.institution_attribution === null).length,
    legacyUnattributedEnum: rows.filter(
      (row) => row.institution_attribution === 'legacy_unattributed',
    ).length,
    institutionIdNull: rows.filter((row) => row.institution_id === null).length,
    institutionIdNotNull: rows.filter((row) => row.institution_id !== null).length,
  };
}

function manifestPayload(manifest) {
  const { manifestDigest: _ignored, ...payload } = manifest;
  return payload;
}

export function buildManifest({ rows, codeSha, schemaFingerprint, capturedAt }) {
  if (!/^[0-9a-f]{40}$/u.test(codeSha)) fail('invalid_code_sha');
  if (!/^[0-9a-f]{64}$/u.test(schemaFingerprint)) fail('invalid_schema_fingerprint');
  const classification = classifySnapshotRows(rows);
  if (classification.overlapCount !== 0) fail('classification_rule_overlap');
  const classifiedTotal = Object.values(classification.classCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (classifiedTotal !== rows.length) fail('classification_not_exhaustive');
  const rules = CLASSIFICATION_RULES.map((rule) => ({
    ...rule,
    EXPECTED_COUNT: classification.ruleCounts[rule.RULE_ID],
  }));
  const payload = {
    version: MANIFEST_VERSION,
    task: S11_TASK,
    baseline: S11_BASELINE,
    codeSha,
    capturedAt,
    historicalCutoffKind: 'EXACT_EVENT_ID_SNAPSHOT',
    schemaFingerprint,
    preCounts: rawPreCounts(rows),
    classCounts: classification.classCounts,
    ruleOverlapCount: classification.overlapCount,
    unsafeGuessedAttributionCount: 0,
    expectedUpdateCount: classification.entries.filter((entry) => entry.dmlRequired).length,
    immutableCohortDigest: sha256(
      canonicalJson(
        classification.entries.map((entry) => ({
          eventId: entry.eventId,
          immutableDigest: entry.immutableDigest,
        })),
      ),
    ),
    lowSensitiveAggregates: buildLowSensitiveAggregates(rows),
    rules,
    rows: classification.entries,
  };
  return { ...payload, manifestDigest: sha256(canonicalJson(payload)) };
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('invalid_manifest');
  if (manifest.version !== MANIFEST_VERSION || manifest.task !== S11_TASK) fail('invalid_manifest_contract');
  if (!Array.isArray(manifest.rows) || !Array.isArray(manifest.rules)) fail('invalid_manifest_shape');
  if (manifest.manifestDigest !== sha256(canonicalJson(manifestPayload(manifest)))) {
    fail('manifest_digest_mismatch');
  }
  if (manifest.ruleOverlapCount !== 0 || manifest.unsafeGuessedAttributionCount !== 0) {
    fail('unsafe_manifest');
  }
  const seen = new Set();
  for (const row of manifest.rows) {
    if (typeof row.eventId !== 'string' || seen.has(row.eventId)) fail('invalid_manifest_row');
    seen.add(row.eventId);
    if (!/^[0-9a-f]{64}$/u.test(row.immutableDigest)) fail('invalid_manifest_row_digest');
    if (!RULE_BY_ID.has(row.ruleId)) fail('unknown_manifest_rule');
    if (!['VERIFIED', 'NOT_APPLICABLE', 'ATTEMPTED_DENIAL', 'UNCLASSIFIABLE'].includes(row.targetClass)) {
      fail('invalid_target_class');
    }
    if (row.dmlRequired) {
      const verified = row.targetClass === 'VERIFIED' && row.targetAttribution === 'verified' &&
        typeof row.targetInstitutionId === 'string' && row.targetInstitutionId.length > 0;
      const notApplicable = row.targetClass === 'NOT_APPLICABLE' &&
        row.targetAttribution === 'not_applicable' && row.targetInstitutionId === null;
      if (!verified && !notApplicable) fail('invalid_dml_target');
      if (row.beforeInstitutionId !== null || row.beforeAttribution !== null) {
        fail('invalid_dml_precondition');
      }
    }
  }
  if (manifest.preCounts.total !== manifest.rows.length) fail('manifest_count_mismatch');
  if (manifest.expectedUpdateCount !== manifest.rows.filter((row) => row.dmlRequired).length) {
    fail('manifest_update_count_mismatch');
  }
  return manifest;
}

export function assertLoopbackDatabaseUrl(value) {
  if (typeof value !== 'string' || value.length === 0) fail('database_url_required');
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('invalid_database_url');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('invalid_database_protocol');
  const hostname = url.hostname.startsWith('[') && url.hostname.endsWith(']')
    ? url.hostname.slice(1, -1)
    : url.hostname;
  if (!ALLOWED_DATABASE_HOSTS.has(hostname)) fail('non_loopback_database_refused');
  if (!url.pathname || url.pathname === '/') fail('database_name_required');
  return url;
}

export function parseCli(argv) {
  const modes = new Set(['--dry-run', '--execute', '--postcheck', '--recover']);
  const selected = argv.filter((arg) => modes.has(arg));
  if (selected.length !== 1) fail('exactly_one_mode_required');
  const mode = selected[0].slice(2);
  const pathFlag = mode === 'dry-run' ? '--manifest-output' : '--manifest';
  const index = argv.indexOf(pathFlag);
  if (index < 0 || typeof argv[index + 1] !== 'string') fail('manifest_path_required');
  const allowed = new Set([selected[0], pathFlag, argv[index + 1]]);
  if (argv.some((arg) => !allowed.has(arg))) fail('unknown_cli_argument');
  return { mode, manifestPath: argv[index + 1] };
}

async function assertSecureManifestParent(filePath, repositoryRoot) {
  if (!isAbsolute(filePath)) fail('manifest_path_must_be_absolute');
  const normalized = resolve(filePath);
  const repo = await realpath(repositoryRoot);
  const parent = await realpath(dirname(normalized));
  const relation = relative(repo, normalized);
  if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) {
    fail('manifest_must_be_outside_repository');
  }
  const parentInfo = await stat(parent);
  if (!parentInfo.isDirectory() || parentInfo.uid !== process.getuid()) fail('unsafe_manifest_parent');
  if ((parentInfo.mode & 0o077) !== 0) fail('manifest_parent_permissions_too_open');
  return normalized;
}

export async function writeSecureManifest(filePath, manifest, repositoryRoot) {
  const normalized = await assertSecureManifestParent(filePath, repositoryRoot);
  const content = `${JSON.stringify(manifest)}\n`;
  if (Buffer.byteLength(content) > MAX_MANIFEST_BYTES) fail('manifest_too_large');
  let handle;
  try {
    handle = await open(
      normalized,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(content, { encoding: 'utf8' });
    await handle.sync();
  } catch (error) {
    if (error?.code === 'EEXIST') fail('manifest_already_exists');
    if (error instanceof S11BackfillError) throw error;
    fail('manifest_write_failed');
  } finally {
    await handle?.close();
  }
  const info = await lstat(normalized);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || info.nlink !== 1) {
    fail('unsafe_written_manifest');
  }
  if ((info.mode & 0o077) !== 0) fail('written_manifest_permissions_too_open');
}

export async function readSecureManifest(filePath, repositoryRoot) {
  const normalized = await assertSecureManifestParent(filePath, repositoryRoot);
  const info = await lstat(normalized).catch(() => fail('manifest_not_found'));
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || info.nlink !== 1) {
    fail('unsafe_manifest_file');
  }
  if ((info.mode & 0o077) !== 0 || info.size > MAX_MANIFEST_BYTES) fail('unsafe_manifest_permissions_or_size');
  let handle;
  try {
    handle = await open(normalized, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const content = await handle.readFile({ encoding: 'utf8' });
    return validateManifest(JSON.parse(content));
  } catch (error) {
    if (error instanceof S11BackfillError) throw error;
    fail('manifest_read_failed');
  } finally {
    await handle?.close();
  }
}

export function getGitState(repositoryRoot) {
  const options = { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  const codeSha = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
  const status = execFileSync('git', ['status', '--porcelain'], options).trim();
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], options).trim();
  if (resolve(root) !== resolve(repositoryRoot)) fail('unexpected_repository_root');
  if (status !== '') fail('worktree_not_clean');
  return { codeSha, repositoryRoot: root };
}

export function assertEnvironment(environment) {
  if (environment !== 'local_development') fail('non_local_development_environment_refused');
}

function createClient(databaseUrl) {
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 1,
    onnotice: () => {},
  });
}

async function schemaFingerprint(sql) {
  const rows = await sql.unsafe(SCHEMA_FINGERPRINT_SQL);
  if (rows.length === 0) fail('audit_schema_missing');
  return sha256(canonicalJson(rows));
}

async function fetchAllSnapshotRows(sql) {
  return sql.unsafe(`${SNAPSHOT_SELECT} ORDER BY a.event_id`);
}

async function fetchCohortRows(sql, eventIds) {
  if (eventIds.length === 0) return [];
  return sql.unsafe(
    `${SNAPSHOT_SELECT} WHERE a.event_id = ANY($1::text[]) ORDER BY a.event_id`,
    [eventIds],
  );
}

function sameAttributionState(row, institutionId, attribution) {
  return (row.institution_id ?? null) === institutionId &&
    (row.institution_attribution ?? null) === attribution;
}

export function validateCohortAgainstManifest(rows, manifest) {
  if (rows.length !== manifest.rows.length) fail('historical_cohort_drift');
  const rowById = new Map(rows.map((row) => [row.event_id, row]));
  let beforeTargetCount = 0;
  let finalTargetCount = 0;
  for (const planned of manifest.rows) {
    const current = rowById.get(planned.eventId);
    if (!current || immutableAuditEventDigest(current) !== planned.immutableDigest) {
      fail('immutable_historical_row_drift');
    }
    const before = sameAttributionState(
      current,
      planned.beforeInstitutionId,
      planned.beforeAttribution,
    );
    const final = sameAttributionState(
      current,
      planned.targetInstitutionId,
      planned.targetAttribution,
    );
    if (planned.dmlRequired) {
      if (!before && !final) fail('attribution_state_drift');
      if (before) beforeTargetCount += 1;
      if (final) finalTargetCount += 1;
      const original = {
        ...current,
        institution_id: planned.beforeInstitutionId,
        institution_attribution: planned.beforeAttribution,
      };
      const [reclassified] = classifySnapshotRows([original]).entries;
      if (
        reclassified.ruleId !== planned.ruleId ||
        reclassified.targetClass !== planned.targetClass ||
        reclassified.targetInstitutionId !== planned.targetInstitutionId ||
        reclassified.targetAttribution !== planned.targetAttribution
      ) fail('classification_evidence_drift');
    } else if (!before) {
      fail('non_target_attribution_drift');
    }
  }
  if (
    beforeTargetCount !== 0 &&
    beforeTargetCount !== manifest.expectedUpdateCount
  ) fail('partial_backfill_state_refused');
  if (
    finalTargetCount !== 0 &&
    finalTargetCount !== manifest.expectedUpdateCount
  ) fail('partial_backfill_state_refused');
  return { rowById, beforeTargetCount, finalTargetCount };
}

async function updateVerifiedGroups(sql, plannedRows) {
  const groups = new Map();
  for (const row of plannedRows.filter(
    (entry) => entry.dmlRequired && entry.targetClass === 'VERIFIED',
  )) {
    const list = groups.get(row.targetInstitutionId) ?? [];
    list.push(row.eventId);
    groups.set(row.targetInstitutionId, list);
  }
  let count = 0;
  for (const [institutionId, eventIds] of groups) {
    const updated = await sql.unsafe(
      `UPDATE audit_events
       SET institution_id = $1, institution_attribution = 'verified'
       WHERE event_id = ANY($2::text[])
         AND institution_id IS NULL
         AND institution_attribution IS NULL
       RETURNING event_id`,
      [institutionId, eventIds],
    );
    count += updated.length;
  }
  return count;
}

async function updateNotApplicable(sql, plannedRows) {
  const eventIds = plannedRows
    .filter((entry) => entry.dmlRequired && entry.targetClass === 'NOT_APPLICABLE')
    .map((entry) => entry.eventId);
  if (eventIds.length === 0) return 0;
  const updated = await sql.unsafe(
    `UPDATE audit_events
     SET institution_id = NULL, institution_attribution = 'not_applicable'
     WHERE event_id = ANY($1::text[])
       AND institution_id IS NULL
       AND institution_attribution IS NULL
     RETURNING event_id`,
    [eventIds],
  );
  return updated.length;
}

async function recoverVerifiedGroups(sql, plannedRows) {
  const groups = new Map();
  for (const row of plannedRows.filter(
    (entry) => entry.dmlRequired && entry.targetClass === 'VERIFIED',
  )) {
    const list = groups.get(row.targetInstitutionId) ?? [];
    list.push(row.eventId);
    groups.set(row.targetInstitutionId, list);
  }
  let count = 0;
  for (const [institutionId, eventIds] of groups) {
    const updated = await sql.unsafe(
      `UPDATE audit_events
       SET institution_id = NULL, institution_attribution = NULL
       WHERE event_id = ANY($1::text[])
         AND institution_id = $2
         AND institution_attribution = 'verified'
       RETURNING event_id`,
      [eventIds, institutionId],
    );
    count += updated.length;
  }
  return count;
}

async function recoverNotApplicable(sql, plannedRows) {
  const eventIds = plannedRows
    .filter((entry) => entry.dmlRequired && entry.targetClass === 'NOT_APPLICABLE')
    .map((entry) => entry.eventId);
  if (eventIds.length === 0) return 0;
  const updated = await sql.unsafe(
    `UPDATE audit_events
     SET institution_id = NULL, institution_attribution = NULL
     WHERE event_id = ANY($1::text[])
       AND institution_id IS NULL
       AND institution_attribution = 'not_applicable'
     RETURNING event_id`,
    [eventIds],
  );
  return updated.length;
}

function finalCountsFromManifest(manifest) {
  return {
    verified: manifest.classCounts.VERIFIED,
    notApplicable: manifest.classCounts.NOT_APPLICABLE,
    attemptedDenial: manifest.classCounts.ATTEMPTED_DENIAL,
    unclassifiable: manifest.classCounts.UNCLASSIFIABLE,
  };
}

function lowSensitiveSummary(mode, manifest, extra = {}) {
  return {
    status: 'passed',
    task: S11_TASK,
    mode,
    historicalCutoffKind: manifest.historicalCutoffKind,
    historicalTotalRowCount: manifest.preCounts.total,
    preBackfillVerifiedCount: manifest.preCounts.verified,
    preBackfillNotApplicableCount: manifest.preCounts.notApplicable,
    preBackfillAttemptedDenialCount: manifest.preCounts.attemptedDenial,
    preBackfillUnattributedCount: manifest.preCounts.unattributed,
    historicalFinalCounts: finalCountsFromManifest(manifest),
    ruleCount: manifest.rules.length,
    ruleOverlapCount: manifest.ruleOverlapCount,
    unsafeGuessedAttributionCount: manifest.unsafeGuessedAttributionCount,
    expectedUpdateCount: manifest.expectedUpdateCount,
    immutableCohortDigest: manifest.immutableCohortDigest,
    manifestDigest: manifest.manifestDigest,
    ...extra,
  };
}

async function dryRun({ client, manifestPath, repositoryRoot, codeSha }) {
  const fingerprint = await schemaFingerprint(client);
  const rows = await client.begin('isolation level repeatable read read only', (sql) =>
    fetchAllSnapshotRows(sql));
  const manifest = buildManifest({
    rows,
    codeSha,
    schemaFingerprint: fingerprint,
    capturedAt: new Date().toISOString(),
  });
  await writeSecureManifest(manifestPath, manifest, repositoryRoot);
  return lowSensitiveSummary('dry-run', manifest, {
    dryRunVerifiedUpdateCount: manifest.rows.filter(
      (row) => row.dmlRequired && row.targetClass === 'VERIFIED',
    ).length,
    dryRunNotApplicableUpdateCount: manifest.rows.filter(
      (row) => row.dmlRequired && row.targetClass === 'NOT_APPLICABLE',
    ).length,
    dryRunAttemptedDenialUpdateCount: 0,
    dryRunTotalUpdateCount: manifest.expectedUpdateCount,
    dryRunUnclassifiableCount: manifest.classCounts.UNCLASSIFIABLE,
    lowSensitiveAggregates: manifest.lowSensitiveAggregates,
  });
}

async function execute({ client, manifest }) {
  const fingerprint = await schemaFingerprint(client);
  if (fingerprint !== manifest.schemaFingerprint) fail('schema_fingerprint_drift');
  const result = await client.begin('isolation level serializable', async (sql) => {
    await sql.unsafe("SET LOCAL lock_timeout = '5s'");
    await sql.unsafe('LOCK TABLE audit_events IN SHARE ROW EXCLUSIVE MODE');
    const [{ count: beforeTotalRaw }] = await sql.unsafe(
      'SELECT count(*)::int AS count FROM audit_events',
    );
    const beforeTotal = Number(beforeTotalRaw);
    const rows = await fetchCohortRows(sql, manifest.rows.map((row) => row.eventId));
    const state = validateCohortAgainstManifest(rows, manifest);
    const expected = state.beforeTargetCount;
    const actual = await updateVerifiedGroups(sql, manifest.rows) +
      await updateNotApplicable(sql, manifest.rows);
    if (actual !== expected) fail('backfill_affected_count_mismatch');
    const postRows = await fetchCohortRows(sql, manifest.rows.map((row) => row.eventId));
    const postState = validateCohortAgainstManifest(postRows, manifest);
    if (postState.finalTargetCount !== manifest.expectedUpdateCount) {
      fail('backfill_post_state_mismatch');
    }
    const [{ count: afterTotalRaw }] = await sql.unsafe(
      'SELECT count(*)::int AS count FROM audit_events',
    );
    const afterTotal = Number(afterTotalRaw);
    if (beforeTotal !== afterTotal) fail('total_row_count_changed');
    return { actual, beforeTotal, afterTotal };
  });
  return lowSensitiveSummary('execute', manifest, {
    actualUpdateCount: result.actual,
    totalRowCountBefore: result.beforeTotal,
    totalRowCountAfter: result.afterTotal,
    idempotentNoOp: result.actual === 0,
  });
}

async function postcheck({ client, manifest }) {
  const fingerprint = await schemaFingerprint(client);
  if (fingerprint !== manifest.schemaFingerprint) fail('schema_fingerprint_drift');
  const result = await client.begin('isolation level repeatable read read only', async (sql) => {
    const rows = await fetchCohortRows(sql, manifest.rows.map((row) => row.eventId));
    const state = validateCohortAgainstManifest(rows, manifest);
    if (state.finalTargetCount !== manifest.expectedUpdateCount) fail('postcheck_not_fully_applied');
    const [{ count: currentTotalRaw }] = await sql.unsafe(
      'SELECT count(*)::int AS count FROM audit_events',
    );
    return { currentTotal: Number(currentTotalRaw) };
  });
  return lowSensitiveSummary('postcheck', manifest, {
    cohortRowCount: manifest.rows.length,
    currentTotalRowCount: result.currentTotal,
    immutableFieldsConserved: true,
    existingValidAttributionPreserved: true,
    unclassifiableRowsUnchanged: true,
  });
}

async function recover({ client, manifest }) {
  const fingerprint = await schemaFingerprint(client);
  if (fingerprint !== manifest.schemaFingerprint) fail('schema_fingerprint_drift');
  const result = await client.begin('isolation level serializable', async (sql) => {
    await sql.unsafe("SET LOCAL lock_timeout = '5s'");
    await sql.unsafe('LOCK TABLE audit_events IN SHARE ROW EXCLUSIVE MODE');
    const rows = await fetchCohortRows(sql, manifest.rows.map((row) => row.eventId));
    const state = validateCohortAgainstManifest(rows, manifest);
    if (state.finalTargetCount !== manifest.expectedUpdateCount) fail('recovery_requires_full_final_state');
    const actual = await recoverVerifiedGroups(sql, manifest.rows) +
      await recoverNotApplicable(sql, manifest.rows);
    if (actual !== manifest.expectedUpdateCount) fail('recovery_affected_count_mismatch');
    const restored = await fetchCohortRows(sql, manifest.rows.map((row) => row.eventId));
    const restoredState = validateCohortAgainstManifest(restored, manifest);
    if (restoredState.beforeTargetCount !== manifest.expectedUpdateCount) {
      fail('recovery_post_state_mismatch');
    }
    return { actual };
  });
  return lowSensitiveSummary('recover', manifest, {
    recoveredRowCount: result.actual,
    restoredExactPreAttributionState: true,
  });
}

export async function runCli({
  argv = process.argv.slice(2),
  environment = process.env.S11_DATABASE_ENVIRONMENT,
  databaseUrl = process.env.S11_DATABASE_URL,
  repositoryRoot = process.cwd(),
  output = (value) => process.stdout.write(`${JSON.stringify(value)}\n`),
} = {}) {
  const command = parseCli(argv);
  assertEnvironment(environment);
  assertLoopbackDatabaseUrl(databaseUrl);
  const git = getGitState(repositoryRoot);
  let manifest = null;
  if (command.mode !== 'dry-run') {
    manifest = await readSecureManifest(command.manifestPath, git.repositoryRoot);
    if (manifest.codeSha !== git.codeSha) fail('code_sha_drift');
  }
  const client = createClient(databaseUrl);
  try {
    const result = command.mode === 'dry-run'
      ? await dryRun({
        client,
        manifestPath: command.manifestPath,
        repositoryRoot: git.repositoryRoot,
        codeSha: git.codeSha,
      })
      : command.mode === 'execute'
        ? await execute({ client, manifest })
        : command.mode === 'postcheck'
          ? await postcheck({ client, manifest })
          : await recover({ client, manifest });
    output(result);
    return result;
  } finally {
    await client.end({ timeout: 5 });
  }
}

function sanitizedFailure(error) {
  return {
    status: 'failed',
    task: S11_TASK,
    error: error instanceof S11BackfillError ? error.code : 'unexpected_failure',
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  runCli().catch((error) => {
    process.stderr.write(`${JSON.stringify(sanitizedFailure(error))}\n`);
    process.exitCode = 1;
  });
}

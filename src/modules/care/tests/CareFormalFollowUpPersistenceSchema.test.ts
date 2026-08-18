import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  careFormalFollowUpEvents,
  careFormalFollowUpTasks,
} from '@/server/db/schema';

describe('Care formal follow-up controlled-write persistence', () => {
  it('defines exact formal task/event tables without mutating legacy follow_up_tasks', () => {
    const task = getTableConfig(careFormalFollowUpTasks);
    const event = getTableConfig(careFormalFollowUpEvents);
    expect(task.name).toBe('care_formal_follow_up_tasks');
    expect(event.name).toBe('care_formal_follow_up_events');
    expect(task.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'tenant_id','institution_id','id','customer_id','state','revision',
        'risk_level','completion_code','assignee_kind','assignee_user_id',
        'assignee_role','idempotency_key','request_digest',
      ]),
    );
    expect(event.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'tenant_id','institution_id','task_id','task_revision',
        'event_type','actor_id','actor_role','reason_code',
      ]),
    );
  });

  it('0050 is forward-only, no business backfill, CAS-guarded and append-only', () => {
    const sql = readFileSync(
      join(process.cwd(), 'drizzle/0050_care_formal_follow_up_controlled_write.sql'),
      'utf8',
    ).toLowerCase();

    expect(sql).toContain('care_formal_follow_up_tasks');
    expect(sql).toContain('care_formal_follow_up_events');
    expect(sql).toContain('care_formal_follow_up_task_state_guard_v1');
    expect(sql).toContain('care_formal_follow_up_event_immutable_guard_v1');
    expect(sql).not.toMatch(/\binsert\s+into\s+"?public"?\."?care_formal_follow_up_tasks"?/u);
    expect(sql).not.toMatch(/\bupdate\s+"?public"?\."?follow_up_tasks"?/u);
    expect(sql).not.toMatch(/\bdelete\s+from\s+"?public"?\."?follow_up_tasks"?/u);
    expect(sql).not.toMatch(/\bdrop\s+(?:table|column|type)\b/u);
  });
});

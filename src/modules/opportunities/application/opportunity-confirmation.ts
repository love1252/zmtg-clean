import { z } from 'zod';
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u);
const instant = z.string().refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const type = z.enum(['revisit', 'repurchase', 'reactivation']);
export const opportunityConfirmationInputSchema = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u), customerId: id, opportunityType: type,
  expectedSourceVersion: z.string().regex(/^opp-src-v1:[0-9a-f]{64}$/u), dueAt: instant, assignment: z.unknown(),
}).strict();
export const opportunityConfirmationSchema = z.object({
  id, customerId: id, opportunityType: type, label: z.string().min(1).max(30), confirmedAt: instant,
  sourceUpdatedAt: instant, ruleVersion: z.literal('customer-lifecycle.v1'),
  task: z.object({ taskId: id, state: z.enum(['pending', 'in_progress', 'waiting_customer', 'escalated', 'completed', 'cancelled']), revision: z.number().int().positive(),
    dueAt: instant, updatedAt: instant, completionCode: z.string().max(64).nullable(), cancellationReason: z.string().max(64).nullable() }).strict(),
}).strict();
export const opportunityConfirmationReadSchema = z.object({
  kind: z.literal('ready'), customerId: id, canConfirm: z.boolean(),
  candidate: z.object({ opportunityType: type, label: z.string().min(1).max(30), basis: z.string().min(1).max(120), sourceVersion: z.string().regex(/^opp-src-v1:[0-9a-f]{64}$/u), sourceUpdatedAt: instant }).strict().nullable(),
  records: z.array(opportunityConfirmationSchema).max(3),
}).strict().refine(data => data.records.every(row => row.customerId === data.customerId) && new Set(data.records.map(row => row.opportunityType)).size === data.records.length);
export type OpportunityConfirmationDto = z.infer<typeof opportunityConfirmationSchema>;
export type OpportunityConfirmationReadDto = z.infer<typeof opportunityConfirmationReadSchema>;

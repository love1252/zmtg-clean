import { z } from 'zod';

const instant = z.string().refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u);
const project = z.string().min(1).refine(value => [...value].length <= 120 && value === value.trim());
const source = z.object({ appointmentId: id, project, scheduledAt: instant, updatedAt: instant }).strict();
export const customerProfileSuggestionSchema = z.object({
  id, customerId: id, fieldName: z.literal('projectInterest'), beforeValue: z.literal(''), proposedValue: project,
  state: z.enum(['pending', 'applied', 'rejected', 'expired']), revision: z.number().int().min(1).max(2), ruleVersion: z.literal('appointment-project.v1'),
  createdAt: instant, expiresAt: instant, decidedAt: instant.nullable(), reasonCode: z.string().max(32).nullable(),
  source: source.extend({ status: z.literal('confirmed') }).strict(),
}).strict().refine(row => row.proposedValue === row.source.project && Date.parse(row.expiresAt) > Date.parse(row.createdAt)
  && (row.state === 'pending' ? row.revision === 1 && row.decidedAt === null : row.state === 'expired' || row.revision === 2 && row.decidedAt !== null));
export const customerProfileReadSchema = z.object({
  kind: z.literal('ready'), customerId: id, projectInterest: z.string().refine(value => [...value].length <= 160), customerUpdatedAt: instant,
  records: z.array(customerProfileSuggestionSchema).max(20), sources: z.array(source).max(20),
  suggestionPage: z.number().int().min(1).max(100), sourcePage: z.number().int().min(1).max(100), hasMoreSuggestions: z.boolean(), hasMoreSources: z.boolean(),
}).strict().refine(value => value.records.every(row => row.customerId === value.customerId) && new Set(value.records.map(row => row.id)).size === value.records.length && new Set(value.sources.map(row => row.appointmentId)).size === value.sources.length);

export type CustomerProfileSuggestionDto = Readonly<{
  id: string;
  customerId: string;
  fieldName: 'projectInterest';
  beforeValue: string;
  proposedValue: string;
  state: 'pending' | 'applied' | 'rejected' | 'expired';
  revision: number;
  ruleVersion: string;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
  reasonCode: string | null;
  source: Readonly<{ appointmentId: string; project: string; status: 'confirmed'; scheduledAt: string; updatedAt: string }>;
}>;
export type CustomerProfileSourceDto = Readonly<{ appointmentId: string; project: string; scheduledAt: string; updatedAt: string }>;
export type CustomerProfileReadDto = Readonly<{
  kind: 'ready';
  customerId: string;
  projectInterest: string;
  customerUpdatedAt: string;
  records: readonly CustomerProfileSuggestionDto[];
  sources: readonly CustomerProfileSourceDto[];
  suggestionPage: number;
  sourcePage: number;
  hasMoreSuggestions: boolean;
  hasMoreSources: boolean;
}>;

import { z } from 'zod';
export const severities = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'] as const;
export const priorities = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;
export const rates = ['Unknown', '1/5', '2/5', '3/5', '4/5', '5/5', 'Always'] as const;
export const platforms = [
  '',
  'PC',
  'PlayStation 5',
  'Xbox Series X/S',
  'Nintendo Switch',
  'Other',
] as const;
export const areas = [
  '',
  'Gameplay',
  'UI',
  'Audio',
  'Graphics',
  'Performance',
  'Network',
  'Save System',
  'Localization',
  'Other',
] as const;
export const detailLevels = ['compact', 'standard', 'detailed'] as const;
export type ReportDetailLevel = (typeof detailLevels)[number];
export const provenanceKeys = [
  'summary',
  'description',
  'preconditions',
  'stepsToReproduce',
  'actualResult',
  'expectedResult',
  'reproductionRate',
  'severity',
  'priority',
  'environment',
  'component',
  'regression',
] as const;
export const provenanceSchema = z.record(
  z.enum(provenanceKeys),
  z.enum(['provided', 'inferred', 'missing']),
);
export type Provenance = z.infer<typeof provenanceSchema>;
export type ProvenanceStatus = Provenance[keyof Provenance];
const list = z.array(z.string().max(2000)).max(30);
export const reportSchema = z.object({
  summary: z.string().max(250),
  description: z.string().max(10000),
  preconditions: list,
  stepsToReproduce: list,
  actualResult: z.string().max(10000),
  expectedResult: z.string().max(10000),
  reproductionRate: z.enum(rates),
  severity: z.enum(severities),
  priority: z.enum(priorities),
  environment: z.string().max(2000),
  component: z.string().max(150),
  regression: z.enum(['Yes', 'No', 'Unknown']),
  labels: list,
  additionalNotes: list,
  missingInformation: list,
  clarifyingQuestions: list.max(5),
  suggestedInvestigation: list,
  provenance: provenanceSchema,
});
export type Report = z.infer<typeof reportSchema>;
export const inputSchema = z.object({
  description: z.string().max(5000),
  platform: z.enum(platforms),
  build: z.string().max(120),
  environment: z.string().max(500),
  area: z.enum(areas),
  reproductionRate: z.enum(rates),
  detailLevel: z.enum(detailLevels).default('standard'),
});
export type IssueInput = z.infer<typeof inputSchema>;
export const emptyInput: IssueInput = {
  description: '',
  platform: '',
  build: '',
  environment: '',
  area: '',
  reproductionRate: 'Unknown',
  detailLevel: 'standard',
};
export const responseSchema = z.object({ report: reportSchema, mode: z.enum(['demo', 'ai']) });
const savedHistorySchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  input: inputSchema,
  report: reportSchema,
  mode: z.enum(['demo', 'ai']),
  followUpAnswers: z.record(z.string().max(2000), z.string().max(2000)).optional(),
  provenanceUnavailable: z.boolean().optional(),
});
export type HistoryItem = z.infer<typeof historyItemSchema>;

// Legacy tickets stay readable; do not present guessed provenance as recorded evidence.
export const historyItemSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || !('report' in value)) return value;
  const report = value.report;
  if (!report || typeof report !== 'object' || 'provenance' in report) return value;
  const old = report as Record<string, unknown>;
  const provenance = Object.fromEntries(
    provenanceKeys.map((key) => {
      const field = old[key];
      const missing =
        !field ||
        (Array.isArray(field) && !field.length) ||
        (typeof field === 'string' && ['unknown', 'not provided'].includes(field.toLowerCase()));
      return [key, missing ? 'missing' : 'inferred'];
    }),
  );
  return {
    ...value,
    provenanceUnavailable: true,
    report: {
      ...old,
      provenance,
      suggestedInvestigation: [],
      clarifyingQuestions: Array.isArray(old.clarifyingQuestions)
        ? old.clarifyingQuestions.slice(0, 5)
        : old.clarifyingQuestions,
    },
  };
}, savedHistorySchema);
export const refinementSchema = z.object({
  originalInput: inputSchema,
  report: reportSchema,
  answers: z
    .array(
      z.object({
        question: z.string().min(1).max(2000),
        answer: z.string().trim().min(1).max(2000),
      }),
    )
    .max(5),
});
export type RefinementInput = z.infer<typeof refinementSchema>;

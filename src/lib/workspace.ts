import { z } from "zod";

export const workspaceResource = z.enum([
  "notes", "note-versions", "experiments", "competitors", "competitor-prices",
  "service-templates", "service-template-versions", "service-cases", "service-case-logs",
  "copilot-conversations", "copilot-messages", "copilot-usage",
]);
export type WorkspaceResource = z.infer<typeof workspaceResource>;
const text = (max: number) => z.string().trim().max(max);
const textList = z.array(z.string().trim().max(80)).max(30);
const metrics = z.record(z.string().max(48), z.number().finite()).refine(v => Object.keys(v).length <= 20);
const base = { id: z.uuid().optional() };
const noteObjectSchema = z.object({ ...base, title: text(240).min(1), body_markdown: z.string().max(100000).default(""), category: text(80).default("未分类"), tags: textList.default([]), folder: text(80).default(""), is_favorite: z.boolean().default(false), is_pinned: z.boolean().default(false), archived_at: z.iso.datetime().nullable().optional(), deleted_at: z.iso.datetime().nullable().optional(), related_type: z.enum(["product","sku","experiment","competitor","service_case","copilot_conversation"]).nullable().optional(), related_id: z.uuid().nullable().optional() }).strip();
export const resourceSchemas = {
  notes: noteObjectSchema.refine(v => Boolean(v.related_type) === Boolean(v.related_id), { message: "关联类型与记录 ID 必须同时提供" }),
  "note-versions": z.object({ ...base, note_id: z.uuid(), version_number: z.number().int().positive(), title: text(240), body_markdown: z.string().max(100000) }).strip(),
  experiments: z.object({ ...base, name: text(180).min(1), experiment_type: z.enum(["main_image","title","detail","price","sku_mix","promotion","custom"]), status: z.enum(["draft","planned","running","paused","completed","cancelled"]).default("draft"), test_design: z.enum(["randomized_ab","before_after"]).default("before_after"), product_id: z.uuid().nullable().optional(), source_note_id: z.uuid().nullable().optional(), goal: text(2000).default(""), hypothesis: text(4000).default(""), original_plan: text(6000).default(""), new_plan: text(6000).default(""), start_date: z.iso.date().nullable().optional(), end_date: z.iso.date().nullable().optional(), baseline_metrics: metrics.default({}), result_metrics: metrics.default({}), assets: z.array(z.string().max(2000)).max(20).default([]), conclusion: text(6000).default(""), next_steps: text(3000).default("") }).strip(),
  competitors: z.object({ ...base, brand: text(120).default(""), product_name: text(240).min(1), product_url: z.string().url().max(2048).or(z.literal("")).default(""), platform: z.enum(["pinduoduo","douyin","taobao","jd","other"]).default("pinduoduo"), specifications: text(1000).default(""), current_price: z.number().finite().nonnegative(), unit_quantity: z.number().finite().positive().nullable().optional(), unit_name: text(24).default("件"), selling_points: textList.default([]), promotion: text(2000).default(""), image_url: z.string().url().max(2048).or(z.literal("")).default(""), source: z.enum(["manual","external"]).default("manual"), source_note: text(1000).default(""), our_product_id: z.uuid().nullable().optional(), archived_at: z.iso.datetime().nullable().optional() }).strip(),
  "competitor-prices": z.object({ ...base, competitor_id: z.uuid(), recorded_on: z.iso.date(), price: z.number().finite().nonnegative(), source_note: text(1000).default("") }).strip(),
  "service-templates": z.object({ ...base, title: text(180).min(1), category: z.enum(["presales","specification","usage","logistics","leakage","refund","complaint","negative_review","follow_up","other"]), body: text(12000).min(1), variables: textList.max(20).default([]), is_favorite: z.boolean().default(false), archived_at: z.iso.datetime().nullable().optional() }).strip(),
  "service-template-versions": z.object({ ...base, template_id: z.uuid(), version_number: z.number().int().positive(), title: text(180), category: text(40), body: text(12000) }).strip(),
  "service-cases": z.object({ ...base, order_number: text(120).default(""), customer_name: text(120).default(""), product_id: z.uuid().nullable().optional(), issue_category: z.enum(["presales","specification","usage","logistics","leakage","refund","complaint","negative_review","follow_up","other"]), description: text(6000).min(1), attachment_paths: z.array(z.string().max(500)).max(20).default([]), assigned_to: z.uuid().nullable().optional(), status: z.enum(["open","processing","waiting_customer","resolved","closed"]).default("open"), resolution: text(6000).default(""), compensation_amount: z.number().finite().nonnegative().default(0), linked_note_id: z.uuid().nullable().optional() }).strip(),
  "service-case-logs": z.object({ ...base, case_id: z.uuid(), action: z.enum(["created","status_changed","note_added","assigned","resolved","attachment_added"]), detail: text(3000).default("") }).strip(),
  "copilot-conversations": z.object({ ...base, title: text(180).default("新对话"), product_ids: z.array(z.uuid()).max(30).default([]), competitor_ids: z.array(z.uuid()).max(30).default([]), deleted_at: z.iso.datetime().nullable().optional() }).strip(),
  "copilot-messages": z.object({ ...base, conversation_id: z.uuid(), role: z.enum(["user","assistant"]), content: text(24000).min(1), citations: z.array(z.record(z.string(), z.unknown())).max(30).default([]), suggestions: z.array(z.string().max(500)).max(20).default([]), model: text(100).nullable().optional(), prompt_tokens: z.number().int().nonnegative().nullable().optional(), completion_tokens: z.number().int().nonnegative().nullable().optional() }).strip(),
  "copilot-usage": z.object({ id: z.uuid() }).strip(),
} satisfies Record<WorkspaceResource, z.ZodObject<z.ZodRawShape>>;
// A PATCH payload is only a fragment. Validate the fragment without running
// cross-field refinements, then validate the merged, complete row before save.
export function workspacePatchSchema(resource: WorkspaceResource) {
  return resource === "notes" ? noteObjectSchema.partial() : resourceSchemas[resource].partial();
}
export const workspaceTable: Record<WorkspaceResource, string> = {
  notes:"operation_notes", "note-versions":"operation_note_versions", experiments:"operation_experiments", competitors:"competitors", "competitor-prices":"competitor_price_history", "service-templates":"service_templates", "service-template-versions":"service_template_versions", "service-cases":"service_cases", "service-case-logs":"service_case_logs", "copilot-conversations":"copilot_conversations", "copilot-messages":"copilot_messages", "copilot-usage":"copilot_usage_logs",
};
export const appendOnlyResources = new Set<WorkspaceResource>(["note-versions","competitor-prices","service-template-versions","service-case-logs","copilot-messages","copilot-usage"]);
export const softDeleteResources = new Set<WorkspaceResource>(["notes","competitors","service-templates","copilot-conversations"]);
export type WorkspaceRow = Record<string, unknown> & { id: string; created_at?: string; updated_at?: string };
export function localWorkspaceKey(storeId: string, resource: WorkspaceResource) { return `moonclean-workspace-v1:${storeId}:${resource}`; }

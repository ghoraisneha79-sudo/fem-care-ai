import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";

type DatasetBody = { dataset_name?: string; rows?: Record<string, unknown>[] };

export default defineHandler(async (event) => {
  const body = await readBody<DatasetBody>(event);
  if (!body?.dataset_name?.trim() || !Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 5000) {
    throw createError({ statusCode: 400, statusMessage: "Provide a dataset name and 1–5000 CSV rows" });
  }
  const columns = new Map<string, number[]>();
  for (const row of body.rows) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (!columns.has(key)) columns.set(key, []);
      columns.get(key)!.push(value);
    }
  }
  const metrics = Array.from(columns.entries()).map(([column, values]) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return { column, count: values.length, mean: Number(mean.toFixed(2)), min: Math.min(...values), max: Math.max(...values), standard_deviation: Number(Math.sqrt(variance).toFixed(2)) };
  });
  if (!metrics.length) throw createError({ statusCode: 400, statusMessage: "No numeric columns found in the uploaded CSV" });
  const summary = { metrics };
  const saved = await sql`INSERT INTO kaggle_analysis_runs (user_id, dataset_name, row_count, summary) VALUES (${event.context.userId as string}, ${body.dataset_name.trim().slice(0, 120)}, ${body.rows.length}, ${JSON.stringify(summary)}::jsonb) RETURNING id, dataset_name, row_count, summary, created_at`;
  return saved[0];
});

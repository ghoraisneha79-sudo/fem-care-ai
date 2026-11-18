import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string;
  const [consent] = await sql`SELECT granted FROM health_consents WHERE user_id = ${userId} AND purpose = 'ml_analysis'`;
  if (!consent?.granted) throw createError({ statusCode: 403, statusMessage: "Enable cycle insight consent to request a forecast" });
  const rows = await sql`SELECT start_date::text AS start_date FROM health_cycles WHERE user_id = ${userId} ORDER BY start_date ASC`;
  const starts = Array.from(new Set(rows.map((row) => String(row.start_date)))).sort();
  const intervals = starts.slice(1).map((date, index) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${starts[index]}T00:00:00Z`)) / 86400000)).filter((days) => days >= 15 && days <= 90);
  if (intervals.length < 2 || !starts.length) return { estimate: null, earliest: null, latest: null, cycle_length_days: intervals.length ? Number((intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1)) : null, history_count: intervals.length, confidence: "insufficient_data", explanation: "At least three valid recorded period starts are needed for a personal estimate." };
  const recent = intervals.slice(-6);
  const length = recent.reduce((a, b) => a + b, 0) / recent.length;
  const spread = Math.sqrt(recent.reduce((sum, value) => sum + (value - length) ** 2, 0) / recent.length);
  const uncertainty = Math.max(3, Math.min(10, Math.round(spread * 1.5 + 2)));
  const estimateDate = new Date(`${starts.at(-1)}T00:00:00Z`);
  estimateDate.setUTCDate(estimateDate.getUTCDate() + Math.round(length));
  const format = (offset: number) => { const value = new Date(estimateDate); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10); };
  return { estimate: format(0), earliest: format(-uncertainty), latest: format(uncertainty), cycle_length_days: Number(length.toFixed(1)), history_count: intervals.length, confidence: intervals.length < 5 || spread > 5 ? "limited" : "moderate", explanation: "A historical-pattern estimate only; cycles can vary and this is not a medical prediction." };
});

import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string;
  const [consent] = await sql`SELECT granted FROM health_consents WHERE user_id = ${userId} AND purpose = 'ml_analysis'`;
  if (!consent?.granted) throw createError({ statusCode: 403, statusMessage: "Enable personal insights consent first" });
  const [cycles, symptoms] = await Promise.all([
    sql`SELECT start_date::text AS start_date FROM health_cycles WHERE user_id = ${userId} ORDER BY start_date ASC`,
    sql`SELECT symptom_code, severity FROM health_symptoms WHERE user_id = ${userId} ORDER BY recorded_on DESC LIMIT 500`,
  ]);
  const dates = Array.from(new Set(cycles.map((row) => String(row.start_date))));
  const intervals = dates.slice(1).map((date, index) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dates[index]}T00:00:00Z`)) / 86400000)).filter((days) => days >= 15 && days <= 90);
  const averageCycleDays = intervals.length ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(1)) : null;
  const grouped = new Map<string, number[]>();
  for (const item of symptoms) {
    const code = String(item.symptom_code);
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code)!.push(Number(item.severity));
  }
  const symptomPatterns = Array.from(grouped.entries()).map(([symptom, values]) => ({ symptom, entries: values.length, average_severity: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) })).sort((a, b) => b.entries - a.entries);
  return { period_starts: dates.length, average_cycle_days: averageCycleDays, symptom_entries: symptoms.length, symptom_patterns: symptomPatterns, note: "Patterns summarize only your saved entries. They are not diagnoses or medical predictions." };
});

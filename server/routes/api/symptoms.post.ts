import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

const supportedSymptoms = new Set(["cramps", "headache", "bloating", "fatigue", "mood_low", "mood_good", "tender_breasts", "sleep_disruption", "libido_change"]);

export default defineHandler(async (event) => {
  const body = await readBody<{ symptoms?: string[]; severity?: number; recorded_on?: string }>(event);
  const symptoms = Array.isArray(body?.symptoms) ? Array.from(new Set(body.symptoms)) : [];
  if (!symptoms.length || symptoms.some((symptom) => !supportedSymptoms.has(symptom))) throw createError({ statusCode: 400, statusMessage: "Select at least one supported symptom" });
  if (!Number.isInteger(body?.severity) || body.severity! < 1 || body.severity! > 10) throw createError({ statusCode: 400, statusMessage: "Severity must be between 1 and 10" });
  const recordedOn = body.recorded_on ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordedOn)) throw createError({ statusCode: 400, statusMessage: "Invalid date" });
  const entries = symptoms.map((symptom_code) => ({ symptom_code, severity: body.severity, recorded_on: recordedOn }));
  return sql`INSERT INTO health_symptoms (user_id, symptom_code, severity, recorded_on) SELECT ${event.context.userId as string}, item.symptom_code, item.severity, item.recorded_on FROM jsonb_to_recordset(${JSON.stringify(entries)}::jsonb) AS item(symptom_code text, severity integer, recorded_on date) RETURNING id, symptom_code, severity, to_char(recorded_on, 'YYYY-MM-DD') AS recorded_on`;
});

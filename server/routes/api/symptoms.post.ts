import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ symptom_code?: string; severity?: number; recorded_on?: string }>(event);
  if (!body?.symptom_code || !/^[a-z_]{2,48}$/.test(body.symptom_code)) throw createError({ statusCode: 400, statusMessage: "Choose a supported symptom" });
  if (!Number.isInteger(body.severity) || body.severity! < 1 || body.severity! > 10) throw createError({ statusCode: 400, statusMessage: "Severity must be between 1 and 10" });
  const recordedOn = body.recorded_on ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordedOn)) throw createError({ statusCode: 400, statusMessage: "Invalid date" });
  return sql`INSERT INTO health_symptoms (user_id, symptom_code, severity, recorded_on) VALUES (${event.context.userId as string}, ${body.symptom_code}, ${body.severity}, ${recordedOn}) RETURNING id, symptom_code, severity, to_char(recorded_on, 'YYYY-MM-DD') AS recorded_on`;
});

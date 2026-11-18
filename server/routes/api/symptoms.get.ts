import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const query = getQuery(event);
  const day = typeof query.day === "string" ? query.day : null;
  if (day) return sql`SELECT id, symptom_code, severity, to_char(recorded_on, 'YYYY-MM-DD') AS recorded_on FROM health_symptoms WHERE user_id = ${event.context.userId as string} AND recorded_on = ${day} ORDER BY created_at DESC`;
  return sql`SELECT id, symptom_code, severity, to_char(recorded_on, 'YYYY-MM-DD') AS recorded_on FROM health_symptoms WHERE user_id = ${event.context.userId as string} ORDER BY recorded_on DESC LIMIT 500`;
});

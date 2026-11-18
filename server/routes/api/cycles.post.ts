import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ start_date?: string; end_date?: string | null; flow?: string | null }>(event);
  if (!body?.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) throw createError({ statusCode: 400, statusMessage: "A valid start date is required" });
  if (body.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.end_date)) throw createError({ statusCode: 400, statusMessage: "Invalid end date" });
  if (body.flow && !["light", "medium", "heavy"].includes(body.flow)) throw createError({ statusCode: 400, statusMessage: "Invalid flow value" });
  return sql`INSERT INTO health_cycles (user_id, start_date, end_date, flow) VALUES (${event.context.userId as string}, ${body.start_date}, ${body.end_date ?? null}, ${body.flow ?? null}) RETURNING id, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, flow`;
});

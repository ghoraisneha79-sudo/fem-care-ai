import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const body = await readBody<{ purpose?: string; granted?: boolean; policy_version?: string }>(event);
  if (!body || body.purpose !== "ml_analysis" || typeof body.granted !== "boolean" || !body.policy_version) throw createError({ statusCode: 400, statusMessage: "Invalid consent settings" });
  return sql`INSERT INTO health_consents (user_id, purpose, granted, policy_version) VALUES (${event.context.userId as string}, ${body.purpose}, ${body.granted}, ${body.policy_version}) ON CONFLICT (user_id, purpose) DO UPDATE SET granted = EXCLUDED.granted, policy_version = EXCLUDED.policy_version, updated_at = NOW() RETURNING purpose, granted, policy_version`;
});

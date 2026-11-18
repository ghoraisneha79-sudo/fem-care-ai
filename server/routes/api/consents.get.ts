import { defineHandler } from "nitro";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => sql`SELECT purpose, granted, policy_version FROM health_consents WHERE user_id = ${event.context.userId as string}`);

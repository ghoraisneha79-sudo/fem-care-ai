import { defineHandler } from "nitro";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => sql`SELECT id, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, flow FROM health_cycles WHERE user_id = ${event.context.userId as string} ORDER BY start_date DESC`);

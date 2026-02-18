import { db } from "../db";
import { appLogs, NewLog } from "../models";


async function uploadToSupabase(parsedLogs: NewLog[]) {
    if (parsedLogs.length === 0) return;

    try {
        // Drizzle handles multiple rows in one single SQL query
        await db.insert(appLogs).values(parsedLogs);
        console.log(`Successfully synced ${parsedLogs.length} logs to Supabase.`);
    } catch (error) {
        console.error("Drizzle Sync Error:", error);
    }
}
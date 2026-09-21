import cron from "node-cron";
import { sendDueReminders } from "./reminders";
import { purgeExpiredLoginCodes } from "./cleanup";

console.log("[worker] BarberBook worker starting — appointment reminder cron every minute.");

async function runReminders() {
  try {
    await sendDueReminders();
  } catch (err) {
    console.error("[worker] failed to send reminders:", err);
  }
}

cron.schedule("* * * * *", runReminders);

// Also run once immediately on boot, so reminders don't wait for the first minute tick.
runReminders();

// Daily housekeeping (03:17 server time): drop long-expired SMS login codes.
cron.schedule("17 3 * * *", async () => {
  try {
    await purgeExpiredLoginCodes();
  } catch (err) {
    console.error("[worker] failed to purge login codes:", err);
  }
});

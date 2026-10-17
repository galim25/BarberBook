import cron from "node-cron";
import { sendDueReminders, sendDuePaymentReminders } from "./reminders";
import { purgeExpiredLoginCodes, purgeFinishedDay } from "./cleanup";

console.log("[worker] BarberBook worker starting — appointment reminder cron every minute.");

async function runReminders() {
  try {
    await sendDueReminders();
    await sendDuePaymentReminders();
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

// Every night at 00:00 Israel time: clear irrelevant admin notifications and past approved appointments.
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      await purgeFinishedDay();
    } catch (err) {
      console.error("[worker] failed nightly purge:", err);
    }
  },
  { timezone: "Asia/Jerusalem" },
);

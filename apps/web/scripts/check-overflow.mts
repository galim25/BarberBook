/**
 * Pre-deploy guard: opens the app's screens in a phone-sized browser and fails if any element sticks out of
 * the screen (the 2026-10-18 incident: two unsized time inputs made /admin wider than the phone, and the
 * browser shrank the text and added sideways scrolling).
 *
 *   pnpm --filter @barberbook/web check:overflow            # against http://localhost:39000
 *   BASE_URL=http://localhost:3000 pnpm --filter @barberbook/web check:overflow
 *
 * Needs a running production build, `SESSION_SECRET` + `DATABASE_URL` in apps/web/.env (it signs a short-lived
 * session for one existing customer and the administrator — it never writes to the database), and Playwright's
 * Chromium (`pnpm exec playwright install chromium`). Development tool: not part of the Docker image.
 */
import { chromium } from "@playwright/test";
import { SignJWT } from "jose";
import { prisma } from "@barberbook/db";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:39000";
const WIDTHS = [320, 360, 393, 430];

async function tokenFor(user: { id: string; role: string; full_name: string }) {
  return new SignJWT({ role: user.role, full_name: user.full_name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
}

const admin = await prisma.user.findFirst({ where: { role: "administrator" } });
const customer = await prisma.user.findFirst({ where: { role: "customer" }, orderBy: { created_at: "desc" } });
const day = await prisma.workDay.findFirst({ where: { ends_at: { gte: new Date() } }, orderBy: { work_date: "asc" } });
await prisma.$disconnect();
if (!admin || !customer) throw new Error("need an administrator and a customer in the database");

const adminPaths = [
  "/admin", "/admin/waitlist", "/admin/waitlist-settings", "/admin/reschedule-requests", "/admin/booking-requests",
  "/admin/cancellation-requests", "/admin/notifications", "/admin/contacts", "/admin/settings",
  "/admin/announcements", "/admin/barbers", "/admin/blocked-customers",
  ...(day ? [`/admin/day/${day.id}`] : []),
];
const customerPaths = ["/account", "/account/book", "/account/appointments"];
const publicPaths = ["/login", "/login/admin"];

const browser = await chromium.launch();
let failures = 0;

async function run(label: string, token: string | null, paths: string[]) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "he-IL" });
    if (token) await ctx.addCookies([{ name: "session", value: token, url: BASE_URL }]);
    const page = await ctx.newPage();
    for (const path of paths) {
      await page.goto(BASE_URL + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      // Open every "add" row a form offers, so dynamic rows (breaks) are measured too.
      for (const add of await page.getByText("+ הוספת הפסקה").all()) await add.click();
      const offenders = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out: string[] = [];
        document.querySelectorAll("body *").forEach((el) => {
          const cs = getComputedStyle(el);
          if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") return;
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) return;
          if (b.right > vw + 1 || b.left < -1) {
            out.push(`<${el.tagName.toLowerCase()}> ${(el.textContent || "").trim().slice(0, 30)} [${Math.round(b.left)}..${Math.round(b.right)}]`);
          }
        });
        return out.slice(0, 4);
      });
      if (offenders.length) {
        failures++;
        console.log(`✗ ${label} ${path} @${width}px`);
        offenders.forEach((o) => console.log("    ", o));
      }
    }
    await ctx.close();
  }
}

await run("public", null, publicPaths);
await run("customer", await tokenFor(customer), customerPaths);
await run("admin", await tokenFor(admin), adminPaths);
await browser.close();

if (failures) {
  console.log(`\n${failures} screen/width combinations overflow the phone screen`);
  process.exit(1);
}
console.log(`✓ no horizontal overflow (${publicPaths.length + customerPaths.length + adminPaths.length} screens × ${WIDTHS.length} widths)`);

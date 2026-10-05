import { NextResponse } from "next/server";
import { prisma } from "@barberbook/db";
import { formatIsraelTime, ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { getActiveBarbers } from "@/lib/actions/barbers";
import {
  getServices,
  getOpenDates,
  getSlotsForDate,
  getEarliestAvailability,
  getWorkDayInterval,
} from "@/lib/actions/booking";
import { getDayPeriods, DAY_PERIOD_LABELS_NIKUD } from "@/lib/availability";
import { registerUserCore } from "@/lib/actions/registerCore";
import { getIvrEnabled } from "@/lib/actions/settings";
import { identifyCaller, generateRandomPassword } from "@/lib/ivr/identifyCaller";
import { bookViaPhone } from "@/lib/ivr/bookViaPhone";
import { sayAndGatherDigits, sayAndGatherSpeech, sayAndHangup } from "@/lib/ivr/yemotResponse";
import { getCallState, setCallState, clearCallState, type CallState } from "@/lib/ivr/callState";

const MAX_MENU_OPTIONS = 9;
const MAX_NAME_ATTEMPTS = 2;

/**
 * 2026-08-09, explicit user request after real test calls: the very first
 * thing a caller hears gave no indication which system/business they'd
 * reached. Prefixed onto all four first-webhook branches of startCall() so
 * it's heard no matter how identifyCaller() resolves. "הגעתם" (2nd-person
 * plural) is gender-neutral, same trick as the "שהתקשרת" comment below.
 * "הַתוֹרִים" deliberately has no dagesh in the ת — this line originally
 * shipped as "הַתּוֹרִים", reintroducing the exact ת+dagesh+cholam-vav
 * combination that the 2026-08-08 pass (see docs/# IVR BarberBook.txt)
 * already found sounds distorted on this TTS ("תוור" instead of "תור"),
 * which is why the greeting was reported as sounding bad. Every other
 * "תוֹר"/"תוֹרִים" in this file was already fixed; this one just missed it.
 */
const WELCOME_GREETING = "הִגַעְתֶם לְמַעֲרֶכֶת קְבִיעַת הַתוֹרִים שֶׁל מָספֶּרָת יוֹסִי. ";

/**
 * 2026-08-08: was hand-built as "{weekday} {day}/{month}" (e.g. "יום ראשון
 * 9/8") to dodge sanitize() stripping the period out of the locale's default
 * numeric rendering (see git history) — but Yemot's TTS reads a bare "/" as
 * division ("9 חלקי 8"), which is worse. `month: "long"` sidesteps both
 * problems at once: he-IL already renders "{day} ב{month}" as natural
 * spoken Hebrew (e.g. "9 באוגוסט"), no slash or period involved.
 */
function weekdayDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: ISRAEL_TIME_ZONE });
}

/**
 * IVR-only natural-speech time (2026-08-08, caller feedback — a bare
 * "13:10" was read with no relation between the hour and minute numbers).
 * Reuses formatIsraelTime's "HH:MM" (shared with SMS/UI text elsewhere,
 * left untouched) and re-renders as "{hour} ו{minute} דקות" — minutes
 * dropped entirely on the hour. Converts to 12-hour (13 → 1) to match how a
 * Hebrew speaker actually reads a clock time aloud ("אחת ועשר דקות", not
 * "שלוש עשרה ועשר דקות") — the shop only ever operates in daytime/evening
 * hours, so the resulting AM/PM ambiguity isn't a real-world problem here.
 */
function speakTime(d: Date): string {
  const [hourStr, minuteStr] = formatIsraelTime(d).split(":");
  const hour12 = Number(hourStr) % 12 === 0 ? 12 : Number(hourStr) % 12;
  const minute = Number(minuteStr);
  return minute === 0 ? `${hour12}` : `${hour12} וְ ${minute} דַקוֹת`;
}

/** §7 step 1 — the very first webhook of an incoming call. */
export async function startCall(apiCallId: string, apiPhone: string | null): Promise<NextResponse> {
  if (!(await getIvrEnabled())) {
    // Global kill switch (AppSettings.ivr_enabled, admin/settings), checked
    // before any caller identification/DB writes — no call state is ever
    // created for a blocked line, so there's nothing for continueCall() to
    // clean up either.
    return sayAndHangup([WELCOME_GREETING, "לא ניתן לקבוע תורים כרגע דרך הטלפון. אנא נסו שוב מאוחר יותר."]);
  }

  const identity = await identifyCaller(apiPhone);

  if (identity.outcome === "no_caller_id") {
    return sayAndHangup([WELCOME_GREETING, "לא ניתן לזהות את מספרך. השתמשו באפליקציה או בקו הרגיל של הַמָסְפֵרָה."]);
  }
  if (identity.outcome === "blocked") {
    return sayAndHangup([WELCOME_GREETING, "לא ניתן לקבוע תור בקו זה. אנא צרו קשר עם הַמָסְפֵרָה."]);
  }

  if (identity.outcome === "existing_user") {
    const state: CallState = {
      step: "barber",
      user_id: identity.user_id,
      customer_name: identity.full_name,
      name_attempts: 0,
      invalid_attempts: 0,
    };
    setCallState(apiCallId, state);
    return renderBarberStep(apiCallId, state, `${WELCOME_GREETING}שָׁלוֹם ${identity.full_name}, בוֹאו נִקְבַע לְךָ תוֹר. `);
  }

  // new_caller
  setCallState(apiCallId, {
    step: "register_name",
    phone_number: identity.phone_number,
    name_attempts: 0,
    invalid_attempts: 0,
  });
  // "שהתקשרת" (2nd-person past) is gender-neutral in Hebrew, unlike "את/ה
  // מתקשר/ת" — also sidesteps the same "/" TTS-reads-as-division bug as
  // weekdayDate (see below), since Yemot reads a bare slash aloud.
  return sayAndGatherSpeech([
    WELCOME_GREETING,
    "שָׁלוֹם, זוֹ הַפַעַם הָרִאשׁוֹנָה שֶׁהִתְקַשַׁרְתָ לַקָו הַזֶה. מָה שִׁמְךָ הַמָלֵא?",
  ]);
}

/** Every subsequent webhook of the same call (every `read=` response of §5/§6 points back at the same Yemot extension). */
export async function continueCall(
  apiCallId: string,
  digits: string,
  speechResult: string,
): Promise<NextResponse> {
  const state = getCallState(apiCallId);
  if (!state) {
    // Lost state (process restart mid-call, or a stray/duplicate request) —
    // no context to recover; apologize and end the call rather than loop.
    clearCallState(apiCallId);
    return sayAndHangup("מצטערים, אירעה תקלה. אנא נסו לחייג שוב.");
  }

  const hasInput = digits.trim() !== "" || speechResult.trim() !== "";
  if (!hasInput) {
    if (state.step === "register_name" || state.step === "register_confirm") {
      return handleRegistrationNoInput(apiCallId, state);
    }
    return handleMenuFailure(apiCallId, state);
  }

  switch (state.step) {
    case "register_name":
      return handleRegisterName(apiCallId, state, speechResult);
    case "register_confirm":
      return handleRegisterConfirm(apiCallId, state, digits);
    case "barber":
      return handleBarberChoice(apiCallId, state, digits);
    case "service":
      return handleServiceChoice(apiCallId, state, digits);
    case "slot_offer":
      return handleSlotOffer(apiCallId, state, digits);
    case "day_pick":
      return handleDayPick(apiCallId, state, digits);
    case "period_pick":
      return handlePeriodPick(apiCallId, state, digits);
    case "time_pick":
      return handleTimePick(apiCallId, state, digits);
    case "book_more":
      return handleBookMore(apiCallId, state, digits);
    default:
      clearCallState(apiCallId);
      return sayAndHangup("מצטערים, אירעה תקלה.");
  }
}

/**
 * Unified "wrong key" policy for every post-identification step (no more
 * live transfer, per explicit decision 2026-08-04 superseding §2 decision
 * #11 of docs/# IVR BarberBook.txt): 1st consecutive failure (no input, or
 * a digit that doesn't map to any offered option) announces the mistake and
 * resets to the main menu (barber selection); a 2nd consecutive failure
 * right after that hangs up. Any valid choice resets the counter to 0 (see
 * each handle*Choice's success branch).
 */
async function handleMenuFailure(apiCallId: string, state: CallState): Promise<NextResponse> {
  state.invalid_attempts += 1;
  if (state.invalid_attempts > 1) {
    clearCallState(apiCallId);
    return sayAndHangup("מצטערים, לא הצלחנו להבין את הבחירה. להתראות.");
  }

  state.barber_id = undefined;
  state.service_id = undefined;
  state.is_child_service = undefined;
  state.step = "barber";
  setCallState(apiCallId, state);
  return renderBarberStep(apiCallId, state, "הפעולה שביצעת אינה תקינה. נחזיר אותך לתפריט הראשי. ");
}

// ---- Step 2: new-caller registration (§7 step 2) ----

async function handleRegistrationNoInput(apiCallId: string, state: CallState): Promise<NextResponse> {
  state.name_attempts += 1;
  if (state.name_attempts >= MAX_NAME_ATTEMPTS) {
    clearCallState(apiCallId);
    return sayAndHangup("לא הצלחנו לזהות את שמך. להתראות.");
  }
  state.step = "register_name";
  setCallState(apiCallId, state);
  return sayAndGatherSpeech("לא התקבל קלט. מה שמך המלא?");
}

async function handleRegisterName(apiCallId: string, state: CallState, speechResult: string): Promise<NextResponse> {
  const name = speechResult.trim();
  if (!name) return handleRegistrationNoInput(apiCallId, state);

  state.pending_name = name;
  state.step = "register_confirm";
  setCallState(apiCallId, state);
  return sayAndGatherDigits(`שָׁמַעְתִי ${name}, נָכוֹן? הַקֵשׁ 1 לְאִישׁור, 2 לְנִסָיוֹן נוֹסָף.`);
}

async function handleRegisterConfirm(apiCallId: string, state: CallState, digits: string): Promise<NextResponse> {
  if (digits === "1") {
    const password = generateRandomPassword();
    const result = await registerUserCore(state.pending_name!, state.phone_number!, password);

    if (result.outcome === "blocked") {
      clearCallState(apiCallId);
      return sayAndHangup("לא ניתן לקבוע תור בקו זה. אנא צרו קשר עם הַמָסְפֵרָה.");
    }

    let user_id: string;
    let full_name: string;
    if (result.outcome === "phone_taken") {
      // Rare race — the number was registered elsewhere mid-call. Fall back to that account.
      const existing = await prisma.user.findUnique({ where: { phone_number: state.phone_number! } });
      if (!existing) {
        clearCallState(apiCallId);
        return sayAndHangup("מצטערים, אירעה תקלה. אנא נסו לחייג שוב.");
      }
      user_id = existing.id;
      full_name = existing.full_name;
    } else {
      user_id = result.user_id;
      full_name = state.pending_name!;
    }

    state.user_id = user_id;
    state.customer_name = full_name;
    state.name_attempts = 0;
    state.invalid_attempts = 0;
    state.step = "barber";
    setCallState(apiCallId, state);
    // Left un-vocalized deliberately (2026-08-08) — nikud + a meteg stress
    // mark were tried here to fix "מעולה" coming out stressed wrong, but the
    // caller reported the plain unvocalized word actually sounded better.
    return renderBarberStep(apiCallId, state, "מעולה. ");
  }

  if (digits === "2") {
    state.name_attempts += 1;
    if (state.name_attempts >= MAX_NAME_ATTEMPTS) {
      clearCallState(apiCallId);
      return sayAndHangup("לא הצלחנו לזהות את שמך. להתראות.");
    }
    state.step = "register_name";
    setCallState(apiCallId, state);
    return sayAndGatherSpeech("בואו ננסה שוב. מה שמך המלא?");
  }

  // Any other digit at this step is simply invalid input, not a "not confirmed" — ask again without spending a name attempt.
  return sayAndGatherDigits(
    `בְחִירָה לֹא תְקִינָה. שָׁמַעְתִי ${state.pending_name}, נָכוֹן? הַקֵשׁ 1 לְאִישׁור, 2 לְנִסָיוֹן נוֹסָף.`,
  );
}

// ---- Step 3: barber selection (§7 step 3) ----

async function renderBarberStep(apiCallId: string, state: CallState, prefix = ""): Promise<NextResponse> {
  const barbers = await getActiveBarbers();
  if (barbers.length === 0) {
    clearCallState(apiCallId);
    return sayAndHangup([prefix, "מצטערים, אין כרגע ספרים זמינים לקביעת תור."]);
  }
  if (barbers.length === 1) {
    state.barber_id = barbers[0].id;
    state.step = "service";
    setCallState(apiCallId, state);
    return renderServiceStep(apiCallId, state, prefix);
  }

  const limited = barbers.slice(0, MAX_MENU_OPTIONS);
  state.barber_options = limited.map((b) => ({ id: b.id, full_name: b.full_name }));
  state.step = "barber";
  setCallState(apiCallId, state);
  const text = limited.map((b, i) => `ל${b.full_name} הַקֵשׁ ${i + 1}`).join(", ") + ".";
  return sayAndGatherDigits([prefix, "לִקְבִיעָה אֵצֶל " + text]);
}

async function handleBarberChoice(apiCallId: string, state: CallState, digits: string): Promise<NextResponse> {
  const chosen = state.barber_options?.[Number(digits) - 1];
  if (!chosen) return handleMenuFailure(apiCallId, state);

  state.invalid_attempts = 0;
  state.barber_id = chosen.id;
  state.step = "service";
  setCallState(apiCallId, state);
  return renderServiceStep(apiCallId, state);
}

// ---- Step 4: service selection (§7 step 4) ----

/**
 * Service names are barber-managed data (`services` table), not code, so
 * they can't carry nikud in the DB itself (that field is also shown as
 * plain text in the admin UI). This is a TTS-only lookup, keyed on the
 * exact current name — 2026-08-08, added after the caller reported this
 * step specifically was hard to follow (rare word "חלאקה", loanword
 * "לייזר", and "+" getting read literally as "plus"). A service not listed
 * here (renamed, or newly added in admin) falls back to the plain DB name —
 * unvocalized and with a literal "+", but still functional.
 */
const SERVICE_NAME_SPEECH: Record<string, string> = {
  "הסרת שיער בלייזר": "הֲסָרַת שֵׂעָר בְּלֵיזֶר",
  "חלאקה": "חֲלָאקָה",
  "תספורת + זקן": "תִסְפֹרֶת וְזָקָן",
  "תספורת ילד": "תִסְפֹרֶת יֶלֶד",
  "תספורת מבוגר": "תִסְפֹרֶת מְבֻגָר",
  "תספורת מבוגר + טיפול לייזר": "תִסְפֹרֶת מְבֻגָר וְטִיפוּל לֵיזֶר",
};

/**
 * 2026-08-08, explicit user request: the phone menu offers a reduced set of
 * services vs. the full list in the app/admin — IVR-only restriction, does
 * not touch the `services` table, the admin UI, or the app's own booking
 * flow (those still offer all services). A service renamed to something not
 * in this list would simply stop being offered over the phone.
 */
const IVR_SERVICE_WHITELIST = new Set(["תספורת מבוגר", "תספורת + זקן", "תספורת ילד"]);

async function renderServiceStep(apiCallId: string, state: CallState, prefix = ""): Promise<NextResponse> {
  const allServices = await getServices(state.barber_id!);
  const services = allServices.filter((s) => IVR_SERVICE_WHITELIST.has(s.name));
  if (services.length === 0) {
    clearCallState(apiCallId);
    return sayAndHangup([prefix, "מצטערים, אין כרגע שירותים זמינים."]);
  }

  const limited = services.slice(0, MAX_MENU_OPTIONS);
  state.service_options = limited.map((s) => ({ id: s.id, name: s.name, is_child_service: s.is_child_service }));
  state.step = "service";
  setCallState(apiCallId, state);
  const text =
    limited.map((s, i) => `ל${SERVICE_NAME_SPEECH[s.name] ?? s.name} הַקֵשׁ ${i + 1}`).join(", ") + ".";
  return sayAndGatherDigits([prefix, text]);
}

async function handleServiceChoice(apiCallId: string, state: CallState, digits: string): Promise<NextResponse> {
  const chosen = state.service_options?.[Number(digits) - 1];
  if (!chosen) return handleMenuFailure(apiCallId, state);

  state.invalid_attempts = 0;
  state.service_id = chosen.id;
  state.is_child_service = chosen.is_child_service;
  setCallState(apiCallId, state);
  return renderSlotOfferStep(apiCallId, state);
}

// ---- Step 5: date/time — earliest-slot offer, or full day/time pick (§7 step 5) ----

async function renderSlotOfferStep(apiCallId: string, state: CallState, prefix = ""): Promise<NextResponse> {
  const earliest = await getEarliestAvailability(state.barber_id!, state.service_id!);
  if (!earliest) {
    // §2 decision #15 — no availability at all: apologize and hang up, no waitlist/transfer.
    clearCallState(apiCallId);
    return sayAndHangup([prefix, "מצטערים, אין כרגע תורים פנויים. נסו שוב מאוחר יותר."]);
  }

  state.offered_work_day_id = earliest.work_day_id;
  state.offered_starts_at = earliest.starts_at;
  state.step = "slot_offer";
  setCallState(apiCallId, state);

  const d = new Date(earliest.starts_at);
  const statement = `הַתוֹר הַקָרוֹב בְיוֹתֵר הוא ${weekdayDate(d)} בְשָׁעָה ${speakTime(d)}.`;
  const menu = `לְאִישׁור הַקֵשׁ 1, לִבְחִירַת יוֹם אַחֵר הַקֵשׁ 2, לִבְחִירַת שָׁעָה אַחֶרֶת בְאוֹתוֹ הַיוֹם הַקֵשׁ 3.`;
  return sayAndGatherDigits([prefix, statement, menu]);
}

async function handleSlotOffer(apiCallId: string, state: CallState, digits: string): Promise<NextResponse> {
  if (digits === "1") {
    state.invalid_attempts = 0;
    return finalizeBooking(apiCallId, state, state.offered_work_day_id!, state.offered_starts_at!);
  }
  if (digits === "2") {
    state.invalid_attempts = 0;
    return renderDayPickStep(apiCallId, state);
  }
  if (digits === "3") {
    state.invalid_attempts = 0;
    return renderTimeOrPeriodStep(
      apiCallId,
      state,
      state.offered_work_day_id!,
      "מצטערים, השעה הזו כבר לא זמינה. ",
    );
  }
  return handleMenuFailure(apiCallId, state);
}

async function renderDayPickStep(apiCallId: string, state: CallState, prefix = ""): Promise<NextResponse> {
  const openDates = await getOpenDates(state.barber_id!);
  const withAvailability: { work_day_id: string; work_date: string }[] = [];
  for (const day of openDates) {
    const slots = await getSlotsForDate(day.work_day_id, state.service_id!);
    if (slots.length > 0) withAvailability.push({ work_day_id: day.work_day_id, work_date: day.work_date });
    if (withAvailability.length >= MAX_MENU_OPTIONS) break;
  }

  if (withAvailability.length === 0) {
    // 2026-08-09, explicit user request: this used to hang up outright.
    // There's still the originally-offered slot (state.offered_*, set by
    // renderSlotOfferStep and never touched on this path) — apologize for
    // there being no *other* dates, then fall back to re-offering it via a
    // fresh renderSlotOfferStep call rather than reusing the stale values
    // directly, so a genuine zero-availability race still correctly hits
    // the real "no availability at all" hangup (decision #15) instead of
    // re-offering a slot that's actually gone.
    return renderSlotOfferStep(apiCallId, state, `${prefix}מצטערים, אין כרגע תאריכים פתוחים נוספים. ניתן לנסות שוב מאוחר יותר. `);
  }

  state.day_options = withAvailability;
  state.step = "day_pick";
  setCallState(apiCallId, state);
  const text =
    withAvailability
      .map((d, i) => `ל${weekdayDate(new Date(`${d.work_date}T00:00:00Z`))} הַקֵשׁ ${i + 1}`)
      .join(", ") + ".";
  return sayAndGatherDigits([prefix, "לִרְשִׁימַת הַיָמִים הַפְתוחִים: " + text]);
}

async function handleDayPick(apiCallId: string, state: CallState, digits: string): Promise<NextResponse> {
  const chosen = state.day_options?.[Number(digits) - 1];
  if (!chosen) return handleMenuFailure(apiCallId, state);

  return renderTimeOrPeriodStep(apiCallId, state, chosen.work_day_id, "מצטערים, היום הזה כבר לא זמין. ");
}

/**
 * Shared by both entry points that land on "here's a specific day, now pick
 * a time" (§9 follow-up, 2026-08-08 — user request): declining the earliest
 * offer with "different time, same day" (handleSlotOffer digit 3), and
 * picking a day from the full list (handleDayPick). A busy day (more than
 * MAX_MENU_OPTIONS slots) gets a morning/בוקר-צהריים-ערב period choice first
 * via getDayPeriods (same boundaries as the booking-UI's period split, see
 * apps/web/src/lib/availability.ts) so the caller isn't forced to sit
 * through 9+ read-out times; a quiet day skips straight to the time list
 * exactly like before this change. Empty buckets are never announced (only
 * periods that actually have availability appear as options), and if
 * splitting still leaves only one non-empty bucket (e.g. a short work day
 * that never reaches the afternoon boundary) there's no real choice to
 * offer, so it also falls through to the plain time list.
 */
async function renderTimeOrPeriodStep(
  apiCallId: string,
  state: CallState,
  work_day_id: string,
  emptyMessage: string,
): Promise<NextResponse> {
  const slots = await getSlotsForDate(work_day_id, state.service_id!);
  if (slots.length === 0) {
    // Availability changed between render and choice (race) — back to the day list, doesn't spend a menu-failure attempt.
    return renderDayPickStep(apiCallId, state, emptyMessage);
  }

  if (slots.length <= MAX_MENU_OPTIONS) {
    state.invalid_attempts = 0;
    state.time_options = slots;
    state.offered_work_day_id = work_day_id;
    state.step = "time_pick";
    setCallState(apiCallId, state);
    return renderTimePickStep(state);
  }

  const workDay = await getWorkDayInterval(work_day_id);
  const bucketed = getDayPeriods(workDay)
    .map((p) => ({
      key: p.key,
      label: p.label,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      slots: slots.filter((s) => new Date(s) >= p.starts_at && new Date(s) < p.ends_at),
    }))
    .filter((b) => b.slots.length > 0);

  if (bucketed.length <= 1) {
    state.invalid_attempts = 0;
    state.time_options = slots.slice(0, MAX_MENU_OPTIONS);
    state.offered_work_day_id = work_day_id;
    state.step = "time_pick";
    setCallState(apiCallId, state);
    return renderTimePickStep(state);
  }

  state.invalid_attempts = 0;
  state.period_options = bucketed.map((b) => ({ key: b.key, label: b.label, slots: b.slots }));
  state.offered_work_day_id = work_day_id;
  state.step = "period_pick";
  setCallState(apiCallId, state);
  const text =
    bucketed
      .map(
        (b, i) =>
          `ל${DAY_PERIOD_LABELS_NIKUD[b.key]} בֵין הַשָׁעוֹת ${speakTime(b.starts_at)} עַד ${speakTime(b.ends_at)} הַקֵשׁ ${i + 1}`,
      )
      .join(", ") + ".";
  // "תרצה/י" avoided (the "/" gets read aloud as division, same bug as
  // weekdayDate above) — phrased as a direct question instead.
  return sayAndGatherDigits("לְאֵיזֶה טְוָח שָׁעוֹת לִקְבֹעַ? " + text);
}

async function handlePeriodPick(apiCallId: string, state: CallState, digits: string): Promise<NextResponse> {
  const chosen = state.period_options?.[Number(digits) - 1];
  if (!chosen) return handleMenuFailure(apiCallId, state);

  state.invalid_attempts = 0;
  state.time_options = chosen.slots.slice(0, MAX_MENU_OPTIONS);
  state.step = "time_pick";
  setCallState(apiCallId, state);
  return renderTimePickStep(state);
}

async function renderTimePickStep(state: CallState, prefix = ""): Promise<NextResponse> {
  const text =
    (state.time_options ?? []).map((s, i) => `${speakTime(new Date(s))} הַקֵשׁ ${i + 1}`).join(", ") + ".";
  return sayAndGatherDigits([prefix, text]);
}

async function handleTimePick(apiCallId: string, state: CallState, digits: string): Promise<NextResponse> {
  const chosen = state.time_options?.[Number(digits) - 1];
  if (!chosen) return handleMenuFailure(apiCallId, state);

  state.invalid_attempts = 0;
  return finalizeBooking(apiCallId, state, state.offered_work_day_id!, chosen);
}

// ---- Step 7: confirm + write (§7 step 7) ----

async function finalizeBooking(
  apiCallId: string,
  state: CallState,
  work_day_id: string,
  starts_at: string,
): Promise<NextResponse> {
  const attendee_name = state.is_child_service ? `ילד/ה של ${state.customer_name}` : undefined;

  const result = await bookViaPhone(
    { work_day_id, service_id: state.service_id!, starts_at, attendee_name },
    { user_id: state.user_id!, customer_name: state.customer_name! },
  );

  if (result.outcome === "slot_taken") {
    // §2 decision #14 — race condition: back to slot selection, doesn't spend a menu-failure attempt.
    return renderSlotOfferStep(apiCallId, state, "מצטערים, השעה הזו נתפסה הרגע. ");
  }
  if (result.outcome === "error") {
    return renderSlotOfferStep(apiCallId, state, "אירעה תקלה בקביעת התור, ננסה שוב. ");
  }

  const d = result.booked.starts_at;
  // "תקבל/י" avoided (same "/" TTS-reads-as-division bug) — passive voice sidesteps the gendered pronoun entirely.
  const confirmText = result.pendingApproval
    ? "הַתוֹר שֶׁלְךָ נִשְׁמַר ומַמְתִין לְאִישׁור הַסַפָר, תִשָׁלַח הוֹדָעָה כְשֶׁהוא יְאַשֵׁר."
    : `מעולה, הַתוֹר נִקְבַע לְ${weekdayDate(d)} בְשָׁעָה ${speakTime(d)}.`;
  const bookMoreMenu = "לִקְבִיעַת תוֹר נוֹסָף בְאוֹתָה שִׂיחָה הַקֵשׁ 1, לְסִיוּם הַקֵשׁ 2.";

  state.step = "book_more";
  setCallState(apiCallId, state);
  // Split into two segments (2026-08-08 caller feedback) so there's an
  // actual gap between "the appointment is set" and "press 1 for another" —
  // see buildSegments() in yemotResponse.ts.
  return sayAndGatherDigits([confirmText, bookMoreMenu]);
}

// ---- Step 8: another appointment in the same call? (§7 step 8) ----

async function handleBookMore(apiCallId: string, state: CallState, digits: string): Promise<NextResponse> {
  if (digits === "1") {
    state.invalid_attempts = 0;
    state.barber_id = undefined;
    state.service_id = undefined;
    state.is_child_service = undefined;
    state.step = "barber";
    setCallState(apiCallId, state);
    return renderBarberStep(apiCallId, state);
  }
  if (digits === "2") {
    clearCallState(apiCallId);
    return sayAndHangup("תוֹדָה, לְהִתְרָאוֹת.");
  }

  return handleMenuFailure(apiCallId, state);
}

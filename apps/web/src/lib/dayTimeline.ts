export type Interval = { starts_at: Date; ends_at: Date };

export type AppointmentBlock = Interval & {
  id: string;
  service_id: string;
  customer_name: string;
  attendee_name: string;
  attendee_type: string;
  service_name: string;
  has_account: boolean;
  booked_via_ivr: boolean;
  phone_number: string | null;
};

export type TimelineSegment =
  | (Interval & { kind: "free" })
  | (Interval & { kind: "break" })
  | (Interval & { kind: "blocked" })
  | (Interval & { kind: "appointment" } & Omit<AppointmentBlock, keyof Interval>);

/**
 * Merges a work day's breaks, blocked times and appointments into a single
 * chronological timeline covering the whole day, filling every gap between
 * them with an explicit "free" segment — so the admin day view can render
 * the full day at a glance instead of just a bare list of appointments.
 */
export function buildDayTimeline(
  dayStart: Date,
  dayEnd: Date,
  breaks: Interval[],
  blockedTimes: Interval[],
  appointments: AppointmentBlock[],
): TimelineSegment[] {
  const busy: TimelineSegment[] = [
    ...breaks.map((b): TimelineSegment => ({ kind: "break", starts_at: b.starts_at, ends_at: b.ends_at })),
    ...blockedTimes.map(
      (b): TimelineSegment => ({ kind: "blocked", starts_at: b.starts_at, ends_at: b.ends_at }),
    ),
    ...appointments.map((a): TimelineSegment => ({ ...a, kind: "appointment" })),
  ].sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());

  const timeline: TimelineSegment[] = [];
  let cursor = dayStart.getTime();

  for (const segment of busy) {
    if (segment.starts_at.getTime() > cursor) {
      timeline.push({ kind: "free", starts_at: new Date(cursor), ends_at: segment.starts_at });
    }
    timeline.push(segment);
    cursor = Math.max(cursor, segment.ends_at.getTime());
  }
  if (cursor < dayEnd.getTime()) {
    timeline.push({ kind: "free", starts_at: new Date(cursor), ends_at: dayEnd });
  }

  return timeline;
}

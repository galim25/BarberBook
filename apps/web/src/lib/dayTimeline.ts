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
  contact_name?: string | null;
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

/**
 * Splits every "free" segment into one free segment per bookable slot on the
 * same grid the customer sees (`findAvailableSlots`): a step every
 * `stepMinutes` from the segment's start, which is already re-anchored to the
 * end of the previous busy block. A slot only counts if a full step fits
 * before the segment ends — a leftover shorter than the shortest service
 * can't be booked anyway. Used by the admin "ניהול היום" page, which lists
 * the day slot by slot instead of as free ranges.
 */
export function splitFreeSegments(timeline: TimelineSegment[], stepMinutes = 10): TimelineSegment[] {
  const step = stepMinutes * 60_000;
  return timeline.flatMap((s): TimelineSegment[] => {
    if (s.kind !== "free") return [s];
    const slots: TimelineSegment[] = [];
    for (let t = s.starts_at.getTime(); t + step <= s.ends_at.getTime(); t += step) {
      slots.push({ kind: "free", starts_at: new Date(t), ends_at: new Date(t + step) });
    }
    return slots;
  });
}

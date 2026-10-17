import { z } from "zod";
import { modeFor, postToMake } from "../core/http";
import { OFFICE_TIME_ZONE, officeDate } from "../core/locale";
import { defineTool, ToolInputError } from "../core/types";

const DAY_MS = 86_400_000;

export const manageCalendar = defineTool({
  name: "manage_calendar",
  description:
    "Read and write the agency's shared calendar (through a Make webhook connected to Google Calendar). list_events shows what is scheduled in a range, find_free_slots finds open meeting times during office hours (Sunday-Thursday, 09:00-18:00 Israel time), and create_event schedules a meeting. Times are ISO 8601 local Israel time without an offset, e.g. 2026-10-20T14:00. Check for free slots before creating an event unless you were given an exact time.",
  schema: z.object({
    action: z.enum(["list_events", "find_free_slots", "create_event"]),
    start: z.string().describe("Range start (list/find) or event start (create)"),
    end: z.string().optional().describe("Range end for list/find; defaults to 7 days after start"),
    duration_minutes: z.number().int().min(15).max(480).optional().describe("Meeting length; default 60"),
    title: z.string().optional().describe("Required for create_event"),
    description: z.string().optional(),
    attendees: z.array(z.string()).optional().describe("Attendee emails for create_event"),
    location: z.string().optional().describe("Address or video link"),
  }),
  activity: (input) => ({
    icon: "📅",
    label: {
      list_events: "בדיקת היומן",
      find_free_slots: "חיפוש זמן פנוי ביומן",
      create_event: `קביעת פגישה: ${input.title ?? ""}`,
    }[input.action],
  }),
  async run(input, { signal }) {
    if (input.action === "create_event" && !input.title) throw new ToolInputError("title is required for create_event");

    const payload = { ...input, duration_minutes: input.duration_minutes ?? 60, time_zone: OFFICE_TIME_ZONE };
    const url = process.env.CALENDAR_WEBHOOK_URL;
    const mode = modeFor(url, input.action === "create_event" ? "write" : "read");
    if (mode === "live") return { mode, ...(await postToMake(url!, payload, signal)) };

    if (input.action === "create_event") return { mode, created: false, would_create: payload };
    if (input.action === "list_events") return { mode, time_zone: OFFICE_TIME_ZONE, events: demoEvents(input.start) };
    return { mode, time_zone: OFFICE_TIME_ZONE, free_slots: demoFreeSlots(input.start, payload.duration_minutes) };
  },
});

function demoEvents(start: string) {
  const day = start.slice(0, 10);
  return [
    { title: "דמו: ישיבת צוות שבועית", start: `${day}T09:30`, end: `${day}T10:15` },
    { title: "דמו: שיחת לקוח", start: `${day}T13:00`, end: `${day}T14:00` },
  ];
}

/** Two office-hours slots per working day (Sunday-Thursday), clear of the demo events */
function demoFreeSlots(start: string, durationMinutes: number) {
  const base = Date.parse(`${start.slice(0, 10)}T12:00:00Z`);
  const slots: { start: string; end: string }[] = [];
  for (let offset = 0; slots.length < 4 && offset < 10; offset++) {
    const { iso, weekday } = officeDate(new Date(base + offset * DAY_MS));
    if (weekday === "Fri" || weekday === "Sat") continue;
    for (const hour of [11, 15]) {
      const endMinutes = hour * 60 + durationMinutes;
      if (endMinutes > 18 * 60) continue;
      const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      slots.push({ start: `${iso}T${hour}:00`, end: `${iso}T${end}` });
    }
  }
  return slots;
}

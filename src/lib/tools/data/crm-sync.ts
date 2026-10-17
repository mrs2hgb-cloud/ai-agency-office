import { z } from "zod";
import { modeFor, postToMake } from "../core/http";
import { normalizeIsraeliPhone, officeDay, upcomingMonthDays } from "../core/locale";
import { defineTool, ToolInputError, type ToolOutput } from "../core/types";
import {
  createRecord,
  fetchAllContacts,
  fireberryConfig,
  updateRecord,
  type CrmContact,
} from "./fireberry";

const MAX_RESULTS = 50;

const ICONS = {
  find_contacts: "👥",
  find_birthdays: "🎂",
  recent_leads: "🙋",
  create_lead: "🙋",
  update_contact: "✏️",
} as const;

export const crmSync = defineTool({
  name: "crm_sync",
  description:
    "Read and update the Fireberry CRM. find_contacts searches clients by name, phone or email. find_birthdays lists clients whose birthday is today or within the next days (Israel time). recent_leads lists leads created in the last few days. create_lead adds a new lead. update_contact changes fields on an existing record, using the CRM's own field names.",
  schema: z.object({
    action: z.enum(["find_contacts", "find_birthdays", "recent_leads", "create_lead", "update_contact"]),
    search: z.string().optional().describe("For find_contacts: part of a name, phone or email"),
    days: z.number().int().min(0).max(31).optional().describe("find_birthdays: days ahead (0 = today). recent_leads: days back"),
    lead: z
      .object({
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
      })
      .optional(),
    contact_id: z.string().optional().describe("For update_contact"),
    fields: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .describe("For update_contact: CRM field name -> new value"),
  }),
  activity: (input) => ({
    icon: ICONS[input.action],
    label: {
      find_contacts: `חיפוש ב-CRM: ${input.search ?? ""}`,
      find_birthdays: "בדיקת ימי הולדת ב-CRM",
      recent_leads: "שליפת לידים חדשים",
      create_lead: `יצירת ליד: ${input.lead?.name ?? ""}`,
      update_contact: "עדכון רשומת לקוח",
    }[input.action],
  }),
  async run(input, { signal }): Promise<ToolOutput> {
    const isWrite = input.action === "create_lead" || input.action === "update_contact";
    if (input.action === "find_contacts" && !input.search) throw new ToolInputError("search is required");
    if (input.action === "create_lead" && !input.lead) throw new ToolInputError("lead is required");
    if (input.action === "update_contact" && (!input.contact_id || !input.fields)) {
      throw new ToolInputError("contact_id and fields are required");
    }

    // A Make scenario with Fireberry modules takes precedence over the direct API
    const webhook = process.env.CRM_WEBHOOK_URL;
    if (webhook) {
      const mode = modeFor(webhook, isWrite ? "write" : "read");
      if (mode === "live") return { mode, ...(await postToMake(webhook, input, signal)) };
    }

    const config = fireberryConfig();
    const mode = modeFor(config.token, isWrite ? "write" : "read");

    switch (input.action) {
      case "find_contacts": {
        const needle = input.search!.toLowerCase();
        const phoneNeedle = normalizeIsraeliPhone(input.search!);
        const contacts = mode === "live" ? await fetchAllContacts(config.contactObjectType, signal) : DEMO_CONTACTS;
        const matches = contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.email?.toLowerCase().includes(needle) ||
            (phoneNeedle && c.phone && normalizeIsraeliPhone(c.phone) === phoneNeedle),
        );
        return { mode, count: matches.length, contacts: matches.slice(0, MAX_RESULTS) };
      }

      case "find_birthdays": {
        const upcoming = upcomingMonthDays(input.days ?? 0);
        const contacts = mode === "live" ? await fetchAllContacts(config.contactObjectType, signal) : DEMO_CONTACTS;
        const matches = contacts
          .filter((c) => c.birthday && upcoming.has(c.birthday.slice(5, 10)))
          .map((c) => ({ ...c, celebrates_on: upcoming.get(c.birthday!.slice(5, 10)) }));
        return { mode, today: officeDay().iso, count: matches.length, clients: matches.slice(0, MAX_RESULTS) };
      }

      case "recent_leads": {
        const since = officeDay(-(input.days ?? 7)).iso;
        const leads = mode === "live" ? await fetchAllContacts(config.leadObjectType, signal) : DEMO_CONTACTS;
        const matches = leads.filter((c) => c.created_on && c.created_on.slice(0, 10) >= since);
        return { mode, since, count: matches.length, leads: matches.slice(0, MAX_RESULTS) };
      }

      case "create_lead": {
        const lead = input.lead!;
        const values = {
          [config.fields.name]: lead.name,
          ...(lead.phone && { [config.fields.phone]: lead.phone }),
          ...(lead.email && { [config.fields.email]: lead.email }),
          ...(lead.source && { leadsource: lead.source }),
          ...(lead.notes && { description: lead.notes }),
        };
        if (mode === "demo") return { mode, created: false, would_create: values };
        return { mode, created: true, ...(await createRecord(config.leadObjectType, values, signal)) };
      }

      case "update_contact": {
        if (mode === "demo") return { mode, updated: false, would_update: { id: input.contact_id, ...input.fields } };
        return {
          mode,
          updated: true,
          ...(await updateRecord(config.contactObjectType, input.contact_id!, input.fields!, signal)),
        };
      }
    }
  },
});

const birthdayIn = (days: number, year: number) => `${year}-${officeDay(days).monthDay}`;

const DEMO_CONTACTS: CrmContact[] = [
  { id: "demo-1", name: "לקוח דמו – נועה", phone: "0500000001", email: "noa@example.com", birthday: birthdayIn(0, 1990), created_on: officeDay(-1).iso },
  { id: "demo-2", name: "לקוח דמו – אורי", phone: "0500000002", email: "uri@example.com", birthday: birthdayIn(2, 1984), created_on: officeDay(-12).iso },
  { id: "demo-3", name: "לקוח דמו – מאיה", phone: "0500000003", email: null, birthday: birthdayIn(6, 1995), created_on: officeDay(-3).iso },
];

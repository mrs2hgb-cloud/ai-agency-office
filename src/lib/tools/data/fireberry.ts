import { requestJson, asRecord } from "../core/http";
import { IntegrationError } from "../core/types";

/**
 * Minimal Fireberry REST client.
 *
 * Endpoint paths and default field names follow Fireberry's public REST API
 * (POST /api/query, /api/record/{objecttype}); verify them against your
 * account at developers.fireberry.com. Field names differ between accounts,
 * so each one can be overridden with an environment variable.
 */

const PAGE_SIZE = 500;
const MAX_PAGES = 20;

export const fireberryConfig = () => ({
  token: process.env.FIREBERRY_API_TOKEN,
  baseUrl: process.env.FIREBERRY_API_URL ?? "https://api.fireberry.com/api",
  contactObjectType: Number(process.env.FIREBERRY_CONTACT_OBJECT_TYPE ?? 2),
  leadObjectType: Number(process.env.FIREBERRY_LEAD_OBJECT_TYPE ?? process.env.FIREBERRY_CONTACT_OBJECT_TYPE ?? 2),
  fields: {
    id: process.env.FIREBERRY_ID_FIELD ?? "contactid",
    name: process.env.FIREBERRY_NAME_FIELD ?? "fullname",
    phone: process.env.FIREBERRY_PHONE_FIELD ?? "mobilephone",
    email: process.env.FIREBERRY_EMAIL_FIELD ?? "emailaddress1",
    birthday: process.env.FIREBERRY_BIRTHDAY_FIELD ?? "birthdaydate",
    createdOn: process.env.FIREBERRY_CREATED_FIELD ?? "createdon",
  },
});

export interface CrmContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  created_on: string | null;
}

const headers = () => ({ tokenid: fireberryConfig().token! });

/**
 * Pages through every record of an object type and maps it to a contact.
 * Filtering happens in code, which keeps us independent of Fireberry's query
 * syntax at the cost of reading up to PAGE_SIZE * MAX_PAGES records.
 */
export async function fetchAllContacts(objectType: number, signal: AbortSignal): Promise<CrmContact[]> {
  const { baseUrl, fields } = fireberryConfig();
  const contacts: CrmContact[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = asRecord(
      await requestJson(`${baseUrl}/query`, {
        headers: headers(),
        body: {
          objecttype: objectType,
          fields: Object.values(fields).join(","),
          page_size: PAGE_SIZE,
          page_number: page,
        },
        signal,
      }),
    );
    const data = asRecord(body.data);
    if (!Array.isArray(data.Data)) throw new IntegrationError("Unexpected Fireberry query response");
    const records = data.Data as Record<string, unknown>[];

    const text = (value: unknown) => (typeof value === "string" && value ? value : null);
    for (const record of records) {
      contacts.push({
        id: String(record[fields.id] ?? ""),
        name: String(record[fields.name] ?? ""),
        phone: text(record[fields.phone]),
        email: text(record[fields.email]),
        birthday: text(record[fields.birthday]),
        created_on: text(record[fields.createdOn]),
      });
    }
    if (records.length < PAGE_SIZE) break;
  }
  return contacts;
}

export async function createRecord(objectType: number, values: Record<string, unknown>, signal: AbortSignal) {
  const { baseUrl } = fireberryConfig();
  return asRecord(await requestJson(`${baseUrl}/record/${objectType}`, { headers: headers(), body: values, signal }));
}

export async function updateRecord(
  objectType: number,
  id: string,
  values: Record<string, unknown>,
  signal: AbortSignal,
) {
  const { baseUrl } = fireberryConfig();
  return asRecord(
    await requestJson(`${baseUrl}/record/${objectType}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: headers(),
      body: values,
      signal,
    }),
  );
}

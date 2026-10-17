import { z } from "zod";
import { modeFor, postToMake } from "../core/http";
import { VAT_RATE, formatShekels, roundMoney } from "../core/locale";
import { defineTool, ToolInputError } from "../core/types";

const DOCUMENT_NAMES = {
  create_invoice: "חשבונית מס",
  create_receipt: "קבלה",
  create_invoice_receipt: "חשבונית מס קבלה",
} as const;

export const invoiceAction = defineTool({
  name: "invoice_action",
  description:
    "Issue billing documents and track payments through the agency's invoicing webhook (Make, connected to the invoicing system). create_invoice, create_receipt and create_invoice_receipt issue a document from line items priced before 18% VAT; issuing waits for human approval automatically. update_payment_status records a payment against an existing document. Use only amounts stated in the request or the conversation; never invent prices.",
  schema: z.object({
    action: z.enum(["create_invoice", "create_receipt", "create_invoice_receipt", "update_payment_status"]),
    client_name: z.string(),
    client_email: z.string().optional(),
    client_id: z.string().optional().describe("The client's CRM id, if known"),
    items: z
      .array(
        z.object({
          description: z.string(),
          quantity: z.number().positive(),
          unit_price: z.number().nonnegative().describe("ILS per unit, before VAT"),
        }),
      )
      .optional()
      .describe("Required when issuing a document"),
    document_id: z.string().optional().describe("Required for update_payment_status"),
    payment_status: z.enum(["paid", "partially_paid", "unpaid", "overdue"]).optional(),
    amount_paid: z.number().nonnegative().optional(),
    payment_method: z.enum(["bank_transfer", "credit_card", "bit", "cash", "check"]).optional(),
    notes: z.string().optional(),
  }),
  activity: (input) => ({
    icon: "🧾",
    label:
      input.action === "update_payment_status"
        ? `עדכון תשלום: ${input.client_name}`
        : `${DOCUMENT_NAMES[input.action]} ל${input.client_name}`,
  }),
  approval: (input) => {
    if (input.action === "update_payment_status") return null;
    const { total } = totals(input.items ?? []);
    return {
      kind: "financial_document",
      summary: `הפקת ${DOCUMENT_NAMES[input.action]} ל${input.client_name} על סך ${formatShekels(total)} כולל מע״מ`,
      details: { client: input.client_name, email: input.client_email, items: input.items, ...totals(input.items ?? []) },
    };
  },
  async run(input, { signal }) {
    const issuing = input.action !== "update_payment_status";
    if (issuing && !input.items?.length) throw new ToolInputError("items are required when issuing a document");
    if (!issuing && (!input.document_id || !input.payment_status)) {
      throw new ToolInputError("document_id and payment_status are required");
    }

    const payload = { ...input, ...(issuing ? { currency: "ILS", ...totals(input.items!) } : {}) };
    const url = process.env.INVOICE_WEBHOOK_URL;
    const mode = modeFor(url, "write");
    if (mode === "demo") return { mode, issued: false, would_send: payload };
    return { mode, ...(await postToMake(url!, payload, signal)) };
  },
});

function totals(items: { quantity: number; unit_price: number }[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  return { subtotal: roundMoney(subtotal), vat: roundMoney(subtotal * VAT_RATE), total: roundMoney(subtotal * (1 + VAT_RATE)) };
}

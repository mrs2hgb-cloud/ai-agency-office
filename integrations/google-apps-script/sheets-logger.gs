/**
 * Google Apps Script web app behind the agents' `sheets_logger` tool and the
 * automatic tool-call audit log. Setup steps: docs/integrations-setup.md.
 *
 * Tabs (created automatically on first use):
 *   יומן פעילות  – every tool call and log_event, appended as it happens
 *   הוצאות       – log_expense
 *   מדדים        – filled by you or another automation; read by get_metrics
 *   תקציבים      – campaign budgets; read by get_metrics
 *
 * Security: set a Script Property SHARED_SECRET and add ?key=<secret> to the
 * web app URL you put in SHEETS_WEBHOOK_URL.
 */

const TIME_ZONE = "Asia/Jerusalem";

const TABS = {
  activity: {
    name: "יומן פעילות",
    headers: ["זמן", "סוכן", "כלי", "תוצאה", "מצב", "קמפיין", "פירוט"],
  },
  expenses: {
    name: "הוצאות",
    headers: ["תאריך", "קמפיין", "קטגוריה", "סכום (₪)", "תיאור", "נרשם על ידי", "זמן רישום"],
  },
  // English headers: get_metrics returns them as JSON keys to the agents
  metrics: {
    name: "מדדים",
    headers: ["date", "campaign", "impressions", "clicks", "leads", "spend_ils", "revenue_ils"],
  },
  budgets: {
    name: "תקציבים",
    headers: ["campaign", "budget_ils"],
  },
};

const OUTCOME_LABELS = { ok: "בוצע", rejected: "נדחה", error: "נכשל" };

function doPost(e) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
    if (secret && e.parameter.key !== secret) return json({ error: "unauthorized" });

    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case "log_event":
        return json(logEvent(body));
      case "log_expense":
        return json(logExpense(body));
      case "get_metrics":
        return json(getMetrics(body));
      default:
        return json({ error: "unknown action: " + body.action });
    }
  } catch (err) {
    // Apps Script can't set an HTTP status, so errors come back as { error }
    return json({ error: String(err) });
  }
}

function logEvent(body) {
  appendRow(TABS.activity, [
    formatTime(body.logged_at),
    body.logged_by || "",
    body.tool || "sheets_logger",
    OUTCOME_LABELS[body.outcome] || "רישום",
    body.mode || "",
    body.campaign || "",
    body.message || "",
  ]);
  return { logged: true };
}

function logExpense(body) {
  const expense = body.expense || {};
  if (!(Number(expense.amount) > 0)) throw new Error("expense.amount must be a positive number");
  appendRow(TABS.expenses, [
    expense.date || Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd"),
    body.campaign || "",
    expense.category || "",
    Number(expense.amount),
    expense.description || "",
    body.logged_by || "",
    formatTime(body.logged_at),
  ]);
  const spent = sumExpenses(body.campaign);
  return { logged: true, campaign: body.campaign, spent_ils: spent };
}

function getMetrics(body) {
  const campaign = normalize(body.campaign);
  const rows = readObjects(TABS.metrics).filter((row) => normalize(row.campaign) === campaign);
  const wanted = Array.isArray(body.metrics) && body.metrics.length ? body.metrics : null;

  const totals = {};
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key === "date" || key === "campaign" || (wanted && wanted.indexOf(key) === -1)) return;
      const value = Number(row[key]);
      if (!isNaN(value)) totals[key] = round((totals[key] || 0) + value);
    });
  });
  if (totals.spend_ils && totals.leads) totals.cpl_ils = round(totals.spend_ils / totals.leads);
  if (totals.clicks && totals.impressions) totals.ctr_percent = round((totals.clicks / totals.impressions) * 100);

  const budgetRow = readObjects(TABS.budgets).filter((row) => normalize(row.campaign) === campaign)[0];
  const budget = budgetRow ? Number(budgetRow.budget_ils) : null;
  const spent = sumExpenses(body.campaign);

  return {
    campaign: body.campaign,
    rows_found: rows.length,
    totals: totals,
    latest: rows.length ? rows[rows.length - 1] : null,
    budget_ils: budget,
    spent_ils: spent,
    remaining_ils: budget === null ? null : round(budget - spent),
  };
}

// ------------------------------------------------------------------ helpers

function sheetFor(tab) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(tab.name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(tab.name);
    sheet.appendRow(tab.headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, tab.headers.length).setFontWeight("bold");
    sheet.setRightToLeft(true);
  }
  return sheet;
}

/** Several agents can log at once; the lock keeps rows from interleaving */
function appendRow(tab, values) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheetFor(tab).appendRow(values);
  } finally {
    lock.releaseLock();
  }
}

function readObjects(tab) {
  const values = sheetFor(tab).getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      const cell = row[i];
      obj[header] = cell instanceof Date ? Utilities.formatDate(cell, TIME_ZONE, "yyyy-MM-dd") : cell;
    });
    return obj;
  });
}

function sumExpenses(campaign) {
  const target = normalize(campaign);
  const values = sheetFor(TABS.expenses).getDataRange().getValues().slice(1);
  return round(
    values.filter((row) => normalize(row[1]) === target).reduce((sum, row) => sum + (Number(row[3]) || 0), 0),
  );
}

function formatTime(iso) {
  return Utilities.formatDate(iso ? new Date(iso) : new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

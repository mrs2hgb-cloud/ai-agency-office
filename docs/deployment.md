# פריסה לשרת Node רציף

האפליקציה רצה כ**תהליך Node אחד וארוך**: Docker, Railway, Render, Fly או VPS. הסיבה: בקשות האישור הממתינות נשמרות בזיכרון של התהליך, וריצת סוכנים יכולה להימשך כמה דקות בזמן שמחכים לאישור שלכם.

> **מופע אחד בלבד.** אל תפעילו autoscaling או כמה replicas. אישור שיגיע למופע אחר מזה שמחכה לו ילך לאיבוד. אם יום אחד תצטרכו כמה מופעים, צריך להעביר את האישורים ל-Redis.

## Docker

```bash
docker build -t ai-agency-office .
docker run -d --name office -p 3000:3000 --env-file .env.production --restart unless-stopped ai-agency-office
```

ה-image בנוי מה-build מסוג `standalone` של Next.js, רץ כמשתמש לא-root, ובודק את עצמו מול `/api/health`.

## Railway / Render

| הגדרה | ערך |
|---|---|
| Build | Dockerfile (מזוהה אוטומטית) |
| Port | `3000` (או המשתנה `PORT` שהפלטפורמה מגדירה) |
| Health check path | `/api/health` |
| Instances / Replicas | **1** |
| Request timeout | לפחות 15 דקות, אם הפלטפורמה מגבילה. הריצה מחכה לאישורים עד `APPROVAL_TIMEOUT_SECONDS`. |

בלי Docker: Build command `npm ci && npm run build`, Start command `npm run start:standalone`.

## משתני סביבה

### חובה

| משתנה | הערה |
|---|---|
| `ANTHROPIC_API_KEY` | סודי |
| `APPROVALS_API_SECRET` | סודי. מגן על הפעלת הסוכנים ועל האישורים. ליצירה: `openssl rand -base64 32` |
| `APP_BASE_URL` | הכתובת הציבורית המלאה, למשל `https://office.example.co.il`. ממנה נבנה הקישור בהתראות. |
| `TOOLS_DRY_RUN` | `true` עד שבדקתם כל חיבור, ואז `false` |

### לפי חיבור

| משתנה | חיבור |
|---|---|
| `LYCHEE_WEBHOOK_URL`, `LYCHEE_API_KEY` | וואטסאפ |
| `APPROVAL_NOTIFY_PHONE` | התראות אישור בוואטסאפ |
| `MAKE_WEBHOOK_API_KEY` | אם הפעלתם אימות ב-webhooks של Make |
| `CRM_WEBHOOK_URL` (או `FIREBERRY_API_TOKEN`) | Fireberry |
| `SHEETS_WEBHOOK_URL` | Google Sheets ויומן הפעולות |
| `CALENDAR_WEBHOOK_URL` | יומן |
| `INVOICE_WEBHOOK_URL` | חשבוניות |
| `LANDING_PAGE_WEBHOOK_URL` | דפי נחיתה |
| `SOCIAL_WEBHOOK_URL` | רשתות חברתיות ו-ManyChat |
| `VISUAL_WEBHOOK_URL` (או `OPENAI_API_KEY`) | ויזואלים |
| `CLICKUP_API_TOKEN` + `CLICKUP_LIST_ID` (או `TASKS_WEBHOOK_URL`) | משימות |

### לא חובה

`ANTHROPIC_MODEL`, `APPROVAL_TIMEOUT_SECONDS` (ברירת מחדל 600), `SHEETS_AUDIT_LOG=false`, ושדות ה-`FIREBERRY_*` (ראו `.env.example`).

את `ENABLE_APPROVAL_TEST` **אל תגדירו** בפרודקשן, אלא לבדיקה חד-פעמית.

## אחרי הפריסה

1. `https://<הדומיין>/api/health` מחזיר `{"ok":true}`.
2. פותחים את האתר ולוחצים על **התחברות למשרד** עם `APPROVALS_API_SECRET`.
3. בודקים את ההתראה מהטלפון לפי [המדריך לחיבור הכלים](integrations-setup.md), שלב ב׳.

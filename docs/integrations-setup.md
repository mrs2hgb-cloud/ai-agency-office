# חיבור הכלים למערכות אמיתיות

המדריך מחבר את הכלים של הסוכנים לשלושה ערוצים, לפי הסדר:

1. **וואטסאפ** (Lychee דרך Make), עבור `send_whatsapp_message`
2. **אישורים**: פאנל האישורים והתראת וואטסאפ אליכם
3. **CRM ונתונים**: Fireberry דרך Make, ו-Google Sheets עבור `sheets_logger`

כל שלב נבדק בנפרד עם `npm run tool`, שמריץ כלי אחד מול החיבור האמיתי בלי להפעיל את הסוכנים, ולכן בלי עלות של Claude.

---

## לפני שמתחילים

```bash
npm install
cp .env.example .env.local
npm run dev
```

בדיקת מצב החיבורים בכל רגע:

```bash
npm run tool -- --status
```

כל כלי מופיע כ-`live` (מחובר) או כ-`demo` (לא מוגדר עדיין, מחזיר נתוני דוגמה ולא שולח כלום).

> **מתג הבטיחות:** כל עוד `TOOLS_DRY_RUN=true` ב-`.env.local`, פעולות עם השפעה חיצונית (שליחה, פרסום, חשבונית) נשארות במצב דמו גם כשהחיבור מוגדר. שנו ל-`false` רק כשאתם מוכנים לשליחה אמיתית.

---

## שלב א׳: ערוץ הוואטסאפ

### 1. תרחיש ב-Make

1. צרו תרחיש חדש. המודול הראשון: **Webhooks › Custom webhook**. צרו webhook חדש והעתיקו את הכתובת.
2. הכניסו את הכתובת ל-`.env.local`:
   ```env
   LYCHEE_WEBHOOK_URL=https://hook.eu2.make.com/xxxxxxxx
   TOOLS_DRY_RUN=false
   ```
3. ב-Make לחצו **Redetermine data structure**, ואז שלחו בקשה אחת כדי ש-Make ילמד את המבנה (החליפו למספר שלכם):
   ```bash
   npm run tool -- send_whatsapp_message '{"message_type":"general","recipients":[{"phone":"050-0000000","name":"בדיקה"}],"message":"בדיקת חיבור מהסוכנים"}'
   ```
4. הוסיפו **Flow Control › Iterator** על השדה `messages`. כל הודעה בנפרד מכילה:
   | שדה | תוכן |
   |---|---|
   | `phone` | מספר בפורמט בינלאומי בלי `+`, למשל `972501234567` |
   | `name` | שם הנמען |
   | `text` | ההודעה הסופית (ה-`{name}` כבר הוחלף) |
5. אחרי ה-Iterator, הוסיפו את מודול השליחה:
   - אם יש ל-Lychee אפליקציה ב-Make, השתמשו במודול השליחה שלה.
   - אחרת, השתמשו ב-**HTTP › Make a request** מול ה-API של Lychee לפי התיעוד שלהם, ומפו את `phone` ו-`text`.
6. (לא חובה) **Webhooks › Webhook response** עם `{"status":"queued"}`, כדי שהסוכן יקבל אישור שליחה.
7. הפעילו את התרחיש (ON).

השדה `message_type` מגיע ברמה העליונה, עם אחד הערכים `meeting_reminder`, `birthday_greeting`, `campaign`, `general` או `approval_request`. אפשר להוסיף Router אם רוצים תבנית או מספר שולח שונה לכל סוג.

> **אבטחה:** אם הפעלתם ב-Make אימות API key ל-webhook, הגדירו את המפתח ב-`MAKE_WEBHOOK_API_KEY`, והוא יישלח בכותרת `x-make-apikey`. אם Lychee דורשת טוקן, `LYCHEE_API_KEY` נשלח כ-`Authorization: Bearer`.

### 2. בדיקה

שלחו ברכה אחת לעצמכם. נמען יחיד לא דורש אישור:

```bash
npm run tool -- send_whatsapp_message '{"message_type":"birthday_greeting","recipients":[{"phone":"<המספר שלכם>","name":"<השם שלכם>"}],"message":"מזל טוב {name}! 🎂"}'
```

תוצאה תקינה: `"mode": "live"` ו-`"sent": 1`, וההודעה מגיעה לטלפון.

שליחה לכמה נמענים תעצור ותשאל אתכם בטרמינל (`Approve? [y/N]`). זה אותו מנגנון אישור שהסוכנים עוברים.

---

## שלב ב׳: שכבת האישורים

### 1. התראת וואטסאפ אליכם

```env
APPROVAL_NOTIFY_PHONE=050-0000000
APP_BASE_URL=http://localhost:3000
```

ההתראה יוצאת דרך אותו תרחיש מהשלב הקודם, עם `message_type: "approval_request"`, ולכן ודאו שהוא לא מסונן אצלכם ב-Router.

> כדי שהקישור בהודעה ייפתח מהטלפון, `APP_BASE_URL` צריך להיות כתובת מוחלטת שהטלפון מגיע אליה: כתובת ה-IP של המחשב ברשת הביתית (`http://192.168.x.x:3000`), מנהרה (cloudflared / ngrok), או הדומיין של האתר אחרי פריסה (`https://office.example.com`). בפריסה שמצביעה על כתובת מקומית נרשמת אזהרה ביומן השרת.

### 2. מפתח האישורים

הפעלת הסוכנים (`/api/campaign`) ונתיבי האישורים (`/api/approvals/*`) מוגנים באותו מפתח:

```env
APPROVALS_API_SECRET=<openssl rand -base64 32>
```

יש שלוש דרכים לקבל הרשאה:

| מי | איך |
|---|---|
| סקריפטים, Make, curl | כותרת `Authorization: Bearer <APPROVALS_API_SECRET>` |
| המשרד בדפדפן | לוחצים על **התחברות למשרד** ומזינים את המפתח פעם אחת. הדפדפן שומר Cookie מאובטח ל-30 יום, ובו חתימה שנגזרת מהמפתח, לא המפתח עצמו. |
| הקישור בוואטסאפ | כולל טוקן חתום שמאשר **רק את הבקשה הזו**, כך שאפשר לאשר מהטלפון בלי להתחבר |

בלי המפתח, ב-`npm run dev` הנתיבים פתוחים (לנוחות הפיתוח), ובפריסה הם חסומים ומחזירים 503.

### 3. בדיקה

כשהאתר פתוח בדפדפן, הריצו:

```bash
curl -X POST http://localhost:3000/api/approvals/test \
  -H "Authorization: Bearer $APPROVALS_API_SECRET"
```

- תוך כמה שניות יופיע במסך פאנל צהוב: **"ממתין לאישור שלך (1)"**.
- לטלפון תגיע הודעה עם תקציר וקישור.
- לחיצה על **אשר** או **דחה** מסירה את הבקשה, ובטרמינל של `npm run dev` תופיע שורה כמו `[approvals] test request …: approved`.

בקשת הבדיקה לא מבצעת שום פעולה. ה-route הזה פעיל רק ב-`npm run dev`, או כש-`ENABLE_APPROVAL_TEST=true`.

### מה דורש אישור

| פעולה | כלי |
|---|---|
| וואטסאפ ליותר מנמען אחד, או כל הודעת קמפיין | `send_whatsapp_message` |
| פרסום או תזמון פוסט, שידור ManyChat | `social_broadcast` |
| העלאת דף נחיתה לאוויר | `manage_landing_page` |
| הפקת חשבונית או קבלה | `invoice_action` |
| כל החלטה שסוכן מבקש לאשר במפורש | `request_human_approval` |

בקשה שלא נענתה תוך `APPROVAL_TIMEOUT_SECONDS` (ברירת מחדל: 10 דקות) נחשבת כדחייה.

> בקשות ממתינות נשמרות בזיכרון של תהליך השרת. זה עובד ב-`npm run dev`, ב-`next start` ובקונטיינר יחיד, אבל לא ב-serverless עם כמה מופעים.

---

## שלב ג׳: CRM ונתונים

### 1. Fireberry דרך Make

הכלי `crm_sync` שולח ל-webhook את השדה `action`, ותרחיש ה-Make מנתב לפיו. בקריאות (חיפוש, ימי הולדת, לידים) התרחיש רק **מחזיר רשומות**, והאפליקציה מסננת בעצמה. כך לא צריך לבנות ב-Make לוגיקה של תאריכים.

**מבנה התרחיש:** `Custom webhook` › `Router` עם שלושה מסלולים:

| מסלול | מסנן (Filter) | מודולים | תגובה (Webhook response) |
|---|---|---|---|
| קריאה | `action` הוא `find_contacts`, `find_birthdays` או `recent_leads` | Fireberry: חיפוש או רשימת רשומות (אנשי קשר. כש-`object` = `leads`, אובייקט הלידים שלכם) › **Array aggregator** | `{"records": [...]}` |
| ליד חדש | `action` = `create_lead` | Fireberry: יצירת רשומה, ממופה מ-`lead.name`, `lead.phone`, `lead.email`, `lead.source`, `lead.notes` | `{"id": "..."}` |
| עדכון | `action` = `update_contact` | Fireberry: עדכון רשומה לפי `contact_id`, עם השדות שב-`fields` | `{"updated": true}` |

**ב-Array aggregator של מסלול הקריאה**, הגדירו מבנה עם השדות האלה בדיוק:

| שדה | מה למפות מ-Fireberry |
|---|---|
| `id` | מזהה הרשומה |
| `name` | שם מלא |
| `phone` | טלפון נייד |
| `email` | אימייל |
| `birthday` | תאריך לידה |
| `created_on` | תאריך יצירה |

תאריכים מתקבלים בכל אחד מהפורמטים `1990-10-17`, `17/10/1990` או חותמת זמן ISO, והקוד ממיר אותם לשעון ישראל. ב-Webhook response הגדירו `Content-Type: application/json` ו-Body:

```json
{"records": {{toJSON(<array-מה-aggregator>)}}}
```

> אם יש לכם הרבה רשומות, הוסיפו לחיפוש ב-Fireberry תנאי שמצמצם את הכמות (למשל רק אנשי קשר עם תאריך לידה). הקוד מחזיר לסוכן עד 50 תוצאות.

ב-`.env.local`:

```env
CRM_WEBHOOK_URL=https://hook.eu2.make.com/yyyyyyyy
```

**בדיקה:**

```bash
npm run tool -- crm_sync '{"action":"find_birthdays","days":7}'
npm run tool -- crm_sync '{"action":"find_contacts","search":"050"}'
```

תוצאה תקינה: `"mode": "live"` ורשימת `clients` או `contacts`. אם מתקבלת השגיאה `The CRM webhook must respond with { "records": [...] }`, חסר מודול Webhook response או שהמבנה שלו שונה.

### 2. Google Sheets

1. צרו גיליון חדש ב-Google Sheets.
2. **Extensions › Apps Script**, מחקו את הקוד הקיים, והדביקו את התוכן של [`integrations/google-apps-script/sheets-logger.gs`](../integrations/google-apps-script/sheets-logger.gs).
3. **Project Settings › Script properties**: הוסיפו `SHARED_SECRET` עם מחרוזת אקראית ארוכה.
4. **Deploy › New deployment › Web app**: הגדירו *Execute as: Me* ו-*Who has access: Anyone*. אשרו את ההרשאות והעתיקו את כתובת ה-Web app.
5. ב-`.env.local` (שימו לב ל-`?key=` בסוף):
   ```env
   SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec?key=<SHARED_SECRET>
   ```

**בדיקה:**

```bash
npm run tool -- sheets_logger '{"action":"log_event","message":"בדיקת חיבור"}'
```

בגיליון ייווצר אוטומטית הגיליון **יומן פעילות** עם שורה חדשה.

מרגע זה **כל קריאה לכלי של כל סוכן** נרשמת שם אוטומטית: מי, איזה כלי, מה נעשה, והאם בוצע, נדחה או נכשל. כך רואים בזמן אמת מה הסוכנים עושים. כדי לכבות: `SHEETS_AUDIT_LOG=false`.

שאר הגליונות נוצרים בשימוש הראשון:

| גיליון | מי ממלא | שימוש |
|---|---|---|
| יומן פעילות | אוטומטית | כל פעולות הסוכנים |
| הוצאות | הסוכנים (`log_expense`) | מעקב תקציב לפי קמפיין |
| מדדים | אתם, או אוטומציה ממערכות הפרסום | `get_metrics`: חשיפות, קליקים, לידים, הוצאה |
| תקציבים | אתם | `get_metrics` מחשב יתרה מול ההוצאות |

> אחרי כל שינוי בסקריפט: **Deploy › Manage deployments › Edit › Version: New version**. בלי זה הכתובת ממשיכה להריץ את הגרסה הקודמת.

---

## תקלות נפוצות

| תסמין | סיבה אפשרית |
|---|---|
| `--status` מראה `demo` למרות שהגדרתם | `npm run dev` ו-`npm run tool` קוראים את `.env.local` רק בהפעלה. הפעילו מחדש. |
| `"mode": "demo"` בפעולת שליחה, למרות שהכתובת מוגדרת | `TOOLS_DRY_RUN=true` |
| `hook… returned 410` | התרחיש ב-Make כבוי, או שה-webhook נמחק |
| `… returned 401` | `MAKE_WEBHOOK_API_KEY` לא תואם למפתח שהוגדר ב-Make |
| `reported an error: unauthorized` | `?key=` בכתובת לא תואם ל-`SHARED_SECRET` |
| ההתראה לא מגיעה | `APPROVAL_NOTIFY_PHONE` ריק, `TOOLS_DRY_RUN=true`, או שה-Router בתרחיש מסנן את `approval_request` |
| הפאנל לא מופיע | הפאנל מתעדכן כל 4 שניות כשאין ריצה פעילה. ודאו שאתם על אותו שרת שיצר את הבקשה, ושהתחברתם עם מפתח האישורים. |
| `503 APPROVALS_API_SECRET is not configured` | בפריסה חובה להגדיר את המפתח |
| `401 unauthorized` | המפתח בכותרת או ב-Cookie שגוי, או שהטוקן בקישור שייך לבקשה אחרת |

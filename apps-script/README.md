# Contact form backend (Google Apps Script)

`contact-form.gs` receives the contact form submission, appends a row to a
Google Sheet, and emails a notification. It runs on Google's infrastructure,
not as part of the Vite build — deploy it manually once:

1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   spreadsheet (e.g. "ATSS Contact Submissions").
2. **Extensions → Apps Script**. Delete the default `Code.gs` content and
   paste in the contents of `contact-form.gs`.
3. Save the project (e.g. name it "ATSS Contact Form").
4. **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, then **Authorize access** with the Google account that
   owns the sheet (this is the account that will send the notification
   emails and own the spreadsheet).
6. Copy the **Web app URL** it gives you.
7. Paste that URL into `CONTACT_FORM_ENDPOINT` in
   [`src/config.js`](../src/config.js), replacing the placeholder.
8. Rebuild/redeploy the site (`npm run build`, then your normal Firebase
   deploy) so the new endpoint ships.

The script auto-creates a "Submissions" sheet tab with columns Timestamp,
Name, Email, Company, Message, Responded. To make the "Responded" column a
checkbox you can tick: select the column, then **Insert → Checkbox** (or
**Data → Data validation → Criteria: Checkbox**).

If you edit the script later, use **Deploy → Manage deployments → Edit →
Version: New version → Deploy** to update the code without changing the
URL. Creating a brand new deployment instead gives you a different URL and
you'd need to update `src/config.js` again.

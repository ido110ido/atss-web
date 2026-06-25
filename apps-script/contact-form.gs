// Deploy this as a Google Apps Script Web App bound to a Google Sheet.
// See apps-script/README.md for setup steps.

const SHEET_NAME = "Submissions";
const NOTIFY_EMAIL = "ido.dev110@gmail.com";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const name = (data.name || "").toString().trim();
    const email = (data.email || "").toString().trim();
    const company = (data.company || "").toString().trim();
    const message = (data.message || "").toString().trim();

    if (!name || !email) {
      return jsonResponse({ ok: false, error: "Missing name or email" });
    }

    appendSubmission(name, email, company, message);
    notifyByEmail(name, email, company, message);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function appendSubmission(name, email, company, message) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Name", "Email", "Company", "Message", "Responded"]);
  }

  sheet.appendRow([new Date(), name, email, company, message, false]);
}

function notifyByEmail(name, email, company, message) {
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: "New ATSS contact form submission from " + name,
    body:
      "Name: " + name +
      "\nEmail: " + email +
      "\nCompany: " + (company || "-") +
      "\n\nMessage:\n" + (message || "-"),
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

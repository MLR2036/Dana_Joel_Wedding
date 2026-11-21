/**
 * Dana & Joel — RSVP receiver.
 *
 * Lives in Google Apps Script, attached to the RSVP Google Sheet (Extensions → Apps Script).
 * Saves each reply as a row and emails the guest a confirmation from this Google account.
 * This copy is in the website repo for reference only; GitHub never runs it.
 * Setup: see README.md.
 */

// ---- Edit these ----
const COUPLE = 'Dana & Joel';
const WEDDING_DATE = 'Saturday 12 June 2027';
const CEREMONY_TIME = '2:00 pm';
const VENUE = 'Hartwell House, Oxford Road, Aylesbury HP17 8NR';
const SITE_URL = 'https://mlr2036.github.io/Dana_Joel_Wedding/'; // GitHub Pages address (or your custom domain later)
const SHEET_NAME = 'RSVPs';
// --------------------

const HEADERS = ['Received', 'Name', 'Email', 'Attending', 'Meal', 'Allergies / dietary', 'Possible duplicate', 'Email sent'];

/** Run once from the editor (select "setup" → Run) to create the sheet and approve permissions. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
  MailApp.getRemainingDailyQuota(); // triggers the "send email" permission prompt now, not on the first guest
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Honeypot filled: a bot. Say ok, save nothing.
    if (d.website) return reply({ ok: true });

    const name = clean(d.name, 120);
    const email = clean(d.email, 200).toLowerCase();
    const attending = d.attending === 'yes' ? 'Yes' : d.attending === 'no' ? 'No' : '';
    const meal = attending === 'Yes' ? clean(d.meal, 20) : '';
    const allergy = attending === 'Yes' ? clean(d.allergy, 500) : '';

    if (name.length < 2) return reply({ ok: false, error: 'Missing name' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ ok: false, error: 'Invalid email' });
    if (!attending) return reply({ ok: false, error: 'Missing attendance' });
    if (attending === 'Yes' && ['Meat', 'Vegetarian'].indexOf(meal) === -1) return reply({ ok: false, error: 'Missing meal' });

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Run setup() first');

    // Same person (name + email) replying again → flag it. Couples sharing one email are fine.
    const key = name.toLowerCase() + '|' + email;
    const last = sheet.getLastRow();
    const existing = last > 1 ? sheet.getRange(2, 2, last - 1, 2).getValues() : [];
    const duplicate = existing.some(function (r) { return String(r[0]).toLowerCase() + '|' + String(r[1]).toLowerCase() === key; });

    sheet.appendRow([new Date(), name, email, attending, meal, allergy, duplicate ? 'Yes: check earlier reply' : '', '']);
    const row = sheet.getLastRow();

    let sent = 'Yes';
    try {
      sendConfirmation(name, email, attending, meal, allergy);
    } catch (mailErr) {
      sent = 'Failed: ' + mailErr; // the reply is still saved; the guest still sees thank-you
    }
    sheet.getRange(row, HEADERS.indexOf('Email sent') + 1).setValue(sent);

    return reply({ ok: true });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: 'Server error' });
  } finally {
    lock.releaseLock();
  }
}

function sendConfirmation(name, email, attending, meal, allergy) {
  const first = name.split(' ')[0];
  const yes = attending === 'Yes';
  const subject = yes ? 'See you on ' + WEDDING_DATE + '!' : 'Thank you for letting us know';

  const lines = yes
    ? [
        'Dear ' + first + ',',
        '',
        "Thank you for your reply. We're so happy you can join us!",
        '',
        'When: ' + WEDDING_DATE + ', ceremony at ' + CEREMONY_TIME,
        'Where: ' + VENUE,
        'Your meal: ' + meal,
        'Allergies / dietary: ' + (allergy || 'None'),
        '',
        'Travel and places to stay: ' + SITE_URL + '#travel',
        '',
        'If anything changes, just reply to this email.',
        '',
        'With love,',
        COUPLE,
      ]
    : [
        'Dear ' + first + ',',
        '',
        "Thank you for letting us know. We're sorry you can't make it, and we'll be thinking of you on the day.",
        '',
        'If your plans change, just reply to this email.',
        '',
        'With love,',
        COUPLE,
      ];

  const body = lines.join('\n');
  const html =
    '<div style="font-family:Georgia,serif;color:#2e2a26;max-width:520px;margin:0 auto;padding:24px;background:#faf7f2;line-height:1.6">' +
    '<p style="font-size:28px;margin:0 0 16px">' + esc(COUPLE).replace('&amp;', '<i style="color:#a8814f">&amp;</i>') + '</p>' +
    lines.slice(0, -2).map(function (l) { return l ? '<p style="margin:0 0 4px">' + esc(l) + '</p>' : '<br>'; }).join('') +
    '<p style="margin:16px 0 0">With love,<br>' + esc(COUPLE) + '</p></div>';

  MailApp.sendEmail({ to: email, subject: subject, body: body, htmlBody: html, name: COUPLE });
}

/** Trim, cap length, and stop text being read as a spreadsheet formula. */
function clean(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

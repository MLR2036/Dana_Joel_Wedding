/**
 * @OnlyCurrentDoc
 * (Tells Google this script only needs the spreadsheet it's attached to, not your whole Drive.)
 *
 * Dana & Joel — RSVP receiver.
 *
 * Lives in Google Apps Script, attached to the RSVP Google Sheet (Extensions → Apps Script).
 * Saves each reply as a row and emails the guest a confirmation from this Google account.
 * This copy is in the website repo for reference only; GitHub never runs it.
 * Setup: see README.md.
 *
 * Security notes:
 * - The web app URL is public (guests' browsers must reach it), so every reply is re-checked here.
 * - Guest text is never treated as a formula in the sheet, and is escaped in the HTML email.
 * - Emails never repeat free text the guest typed (only a cleaned first name and the fixed meal
 *   choice), so nobody can use this script to send their own message from your Gmail.
 * - Rate limits stop floods: a few replies per email address, and a cap per hour overall.
 */

// ---- Edit these ----
const COUPLE = 'Dana & Joel';
const WEDDING_DATE = 'Saturday 12 June 2027';
const CEREMONY_TIME = '2:00 pm';
const VENUE = 'Hartwell House, Oxford Road, Aylesbury HP17 8NR';
const SITE_URL = 'https://mlr2036.github.io/Dana_Joel_Wedding/'; // GitHub Pages address (or your custom domain later)
const SHEET_NAME = 'RSVPs';

// Rate limits (a window restarts an hour after the most recent reply that counts toward it).
const MAX_PER_EMAIL_PER_HOUR = 4;  // a couple sharing one address, plus a correction or two
const MAX_TOTAL_PER_HOUR = 40;     // the whole site; real guests won't come close
const KEEP_EMAILS_IN_RESERVE = 5;  // stop sending confirmations when Gmail's daily quota gets this low
// --------------------

const HEADERS = ['Received', 'Name', 'Email', 'Attending', 'Meal', 'Allergies / dietary', 'Possible duplicate', 'Email sent'];
const MEALS = ['Meat', 'Vegetarian'];
const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

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
  let locked = false;
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > 5000) return reply({ ok: false, error: 'invalid' }); // real replies are far smaller

    let d;
    try { d = JSON.parse(raw); } catch (parseErr) { return reply({ ok: false, error: 'invalid' }); }
    if (!d || typeof d !== 'object') return reply({ ok: false, error: 'invalid' });

    // Honeypot filled: a bot. Say ok, save nothing.
    if (d.website) return reply({ ok: true });

    const name = clean(d.name, 120);
    const email = clean(d.email, 200).toLowerCase();
    const attending = d.attending === 'yes' ? 'Yes' : d.attending === 'no' ? 'No' : '';
    const meal = attending === 'Yes' ? clean(d.meal, 20) : '';
    const allergy = attending === 'Yes' ? clean(d.allergy, 500) : '';

    if (name.length < 2) return reply({ ok: false, error: 'invalid' });
    if (!EMAIL_RE.test(email)) return reply({ ok: false, error: 'invalid' });
    if (!attending) return reply({ ok: false, error: 'invalid' });
    if (attending === 'Yes' && MEALS.indexOf(meal) === -1) return reply({ ok: false, error: 'invalid' });

    lock.waitLock(15000);
    locked = true;

    // Rate limits, checked only for well-formed replies so junk can't lock real guests out.
    if (overLimit('total', MAX_TOTAL_PER_HOUR) || overLimit('email:' + email, MAX_PER_EMAIL_PER_HOUR)) {
      return reply({ ok: false, error: 'busy' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Run setup() first');

    // Same person (name + email) replying again → flag it. Couples sharing one email are fine.
    const key = name.toLowerCase() + '|' + email;
    const last = sheet.getLastRow();
    const existing = last > 1 ? sheet.getRange(2, 2, last - 1, 2).getValues() : [];
    const duplicate = existing.some(function (r) { return String(r[0]).toLowerCase() + '|' + String(r[1]).toLowerCase() === key; });

    sheet.appendRow([new Date(), name, email, attending, meal, allergy, duplicate ? 'Yes: check earlier reply' : '', '']);
    const row = sheet.getLastRow();

    let sent;
    if (MailApp.getRemainingDailyQuota() <= KEEP_EMAILS_IN_RESERVE) {
      sent = 'Not sent: daily email limit reached';
    } else {
      try {
        sendConfirmation(name, email, attending, meal, Boolean(allergy));
        sent = 'Yes';
      } catch (mailErr) {
        sent = 'Failed: ' + String(mailErr).slice(0, 200); // the reply is still saved; the guest still sees thank-you
      }
    }
    sheet.getRange(row, HEADERS.indexOf('Email sent') + 1).setValue(sent);

    return reply({ ok: true });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: 'server' });
  } finally {
    if (locked) lock.releaseLock();
  }
}

/**
 * The confirmation never includes free text the guest typed: only a cleaned first name and the
 * meal (which must be one of MEALS). Allergy details stay in the sheet.
 */
function sendConfirmation(name, email, attending, meal, hasAllergy) {
  const first = safeFirstName(name);
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
        'Dietary requirements: ' + (hasAllergy ? "noted, and we'll pass them on to our caterers" : 'none'),
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

/** First word of the name, letters plus ' and - only, at most 30 characters. Falls back to "friend". */
function safeFirstName(name) {
  const first = String(name).split(' ')[0].replace(/[^\p{L}'\-]/gu, '').slice(0, 30);
  return first.length >= 1 && /\p{L}/u.test(first) ? first : 'friend';
}

/** Counts one use of `key`; true if it is already at `max` within the last hour. Call inside the lock. */
function overLimit(key, max) {
  const cache = CacheService.getScriptCache();
  const k = 'rl:' + Utilities.base64EncodeWebSafe(key).slice(0, 200);
  const n = Number(cache.get(k) || 0);
  if (n >= max) return true;
  cache.put(k, String(n + 1), 3600);
  return false;
}

/**
 * Trim, cap length, remove control and invisible characters (zero-width spaces, right-to-left
 * overrides and similar, which can disguise text), and stop text being read as a spreadsheet formula.
 */
function clean(v, max) {
  let s = String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[­؜᠎​-‏‪-‮⁠-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

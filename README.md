# Dana & Joel — wedding site

One page: landing photo → the day → RSVP → travel & stay.
Plain HTML, CSS and JavaScript, hosted free on GitHub Pages. RSVPs go to a Google Sheet through a small Google Apps Script, which also emails each guest a confirmation.

```
index.html          the whole site
css/styles.css      colours, type and layout (from the Wedding Site design system)
js/rsvp.js          the RSVP form: show/hide fields, checks, sending, thank-you
images/hero.jpg     your landing photo (add this)
apps-script/Code.gs the RSVP receiver. Copy it into Google Apps Script; GitHub never runs it
```

## 1. Make a wedding Gmail

Create a Google account just for the wedding (e.g. `danaandjoel.wedding@gmail.com`). The sheet, the script and the confirmation emails all live there, so your personal address stays out of it and you can both sign in to check replies.

## 2. Set up the RSVP sheet

1. Signed in as the wedding account, create a Google Sheet called **RSVPs**.
2. **Extensions → Apps Script**. Delete what's there and paste in everything from `apps-script/Code.gs`.
3. Edit the lines under `---- Edit these ----` at the top (date, venue, and later `SITE_URL`). Save.
4. In the function dropdown pick **setup**, then **Run**. Approve the permissions (Google warns that the app is unverified, because it's your own script: **Advanced → Go to … (unsafe)**). A sheet tab called *RSVPs* appears with headings.

## 3. Publish the script and connect the form

1. In Apps Script: **Deploy → New deployment → ⚙ → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
2. **Deploy** and copy the **Web app URL** (ends in `/exec`).
3. In `js/rsvp.js`, replace `PASTE_YOUR_APPS_SCRIPT_URL_HERE` with that URL.

> Changed the script later? Use **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. That keeps the same URL. "New deployment" makes a new URL, and you'd have to update `rsvp.js` again.

## 4. Add your photo

Save a landscape photo as `images/hero.jpg`, about 2000px wide and under 500 KB. Pick one with calm space in the middle for the names. Until it's there, a soft green background shows.

## 5. Publish on GitHub Pages

Keep your personal email out of the public commit history first:

1. On GitHub: **Settings → Emails** → tick **Keep my email addresses private** and **Block command line pushes that expose my email**. Copy the `…@users.noreply.github.com` address shown.
2. In this folder:

```bash
git init
```

```bash
git config user.email "YOUR-ID+YOUR-USERNAME@users.noreply.github.com"
```

```bash
git add . && git commit -m "Wedding site"
```

3. Connect this folder to the GitHub repo [MLR2036/Dana_Joel_Wedding](https://github.com/MLR2036/Dana_Joel_Wedding) and push:

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/MLR2036/Dana_Joel_Wedding.git
```

```bash
git push -u origin main
```

4. Repo **Settings → Pages** → Source: **Deploy from a branch** → `main` / `(root)` → Save. The site appears at **https://mlr2036.github.io/Dana_Joel_Wedding/** within a minute or two.
5. `SITE_URL` in `apps-script/Code.gs` is already set to that address. Copy the updated file into Apps Script and publish a new version (see the note in step 3) so the confirmation emails link to the live site.

Optional: a custom domain such as `danaandjoel.co.uk`. Buy it, then add it under **Settings → Pages → Custom domain** and follow GitHub's DNS steps.

## Test it

Open the live site and send a reply to yourself, once accepting and once declining. Check that:
- a row appears in the sheet,
- the confirmation email arrives (check spam the first time),
- after accepting, the page scrolls down to Travel.

Then delete your test rows.

## Using the sheet

- **Possible duplicate** is filled in when the same name *and* email reply again. Couples sharing one email address are not flagged. Keep the latest reply and delete the earlier one.
- **Email sent** shows whether the confirmation went out. Gmail lets a script send about 100 emails a day, which is plenty here.
- Use **Data → Create a filter** to filter by Attending or Meal for the caterers.

## Privacy

- The site is set to `noindex`, so search engines won't list it. Share the link with guests directly.
- Allergy details are health information: share the sheet only with whoever needs it, and delete the sheet after the wedding, as the form promises.
- Never commit an export of the sheet to this repo. The `.gitignore` blocks common export files as a safety net.

## Still placeholders

Venue, date, times, dress code, taxi number, hotels, prices, the `DANAJOEL` booking code and the "Book a room" links are all examples. Swap in the real details in `index.html` and at the top of `Code.gs`.

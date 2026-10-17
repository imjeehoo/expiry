# Expiry

A fast, mobile-first web app for logging stock by **name / weight / expiry date / amount**, then exporting to Excel (`.xlsx`).

No build step, no dependencies, works offline (PWA). Open `index.html` from any static host, or "Add to Home Screen" on your phone.

## Flow

1. Type the **name** → Next → **weight** (decimal keypad, tap a unit: g / kg / ml / L).
2. Type the expiry as **MMDD** on the number pad (e.g. `1225`). The year is predicted (the next time that date comes up) and shown on the year chips (this year … +5). Tap a chip to set the year; it stays set for the rest of this item.
3. Focus jumps to **amount** on its own. Type the amount (leave it empty for 1) → **Add**.
4. Name and weight stay filled in. Keep typing date → amount → Add for each extra expiry date of the same item.
5. **New item** clears everything for the next product. Tap a group in the list to add more dates to it later.
6. **Export** creates `expiry-YYYY-MM-DD-HHMM.xlsx` (Name, Weight, Unit, Expiry as a real Excel date, Amount). On phones it opens the share sheet, so you can save it to Files or send it.

Date entry tips: digits that can't start a valid number are padded for you (`3` → `03`, `65` → `06.05`), so short dates need fewer keystrokes. Tap the "유통기한 · YY.MM.DD" label to switch to DD.MM.

Entries are saved in the browser (localStorage) until you clear them. Deleting a row or clearing all can be undone from the toast.

## Files

- `index.html`, `style.css`, `app.js`: the app
- `xlsx.js`: a small dependency-free `.xlsx` writer
- `sw.js`, `manifest.webmanifest`, `icon*`: offline support and home-screen install

## Hosting

Any static host works, for example GitHub Pages (Settings → Pages → deploy from branch, root). The service worker needs HTTPS (or `localhost`).

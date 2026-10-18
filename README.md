# 유통기한

A fast, mobile-first web app for logging stock by **name / weight / expiry date / amount**, then exporting to Excel (`.xlsx`). Korean UI, installable as a PWA, works offline. Data stays in the browser (localStorage).

Built with Vite, React and TypeScript. The only runtime dependencies are `react` and `react-dom`; the Excel reader/writer is in-house (`src/lib/excel`).

## Using it

- **Home** is the list of items. Each item shows its expiry dates (earliest first) and amounts. Tap an item's name to add more dates to it, or **품목 추가** to add a new item. The `⋯` button on a row opens **수정** (name / weight / amount) or **삭제**.
- **Add screen**: one field at a time (이름 → 무게 → 유통기한 → 수량). Next collapses the finished field to text and opens the following one above it; tap a finished field to change it. After the amount, the lot is saved and a fresh date opens for the same item. Dates are typed as six digits, `YYMMDD` (`261225`). **새 품목** clears the form; **‹ 목록** (or the back gesture) returns home. Entries added in this visit stay pinned above the buttons so typos are easy to catch.
- **내보내기** writes `expiry-YYYY-MM-DD-HHMM.xlsx` (이름, 무게, 단위, 유통기한, 수량). Items keep their entry order, dates run earliest first, and weights are always in g / ml. On phones it opens the share sheet.
- **가져오기** reads such a file back (Korean or English headers, weights like `500g` are split). Rows already in the list are skipped, so re-importing an export adds nothing.
- Anything destructive (delete, clear all, import) has an undo in the toast.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (dates, weights, grouping, excel, import/export, reducer)
npm run typecheck
npm run build      # outputs dist/
npm run preview    # serve dist/ locally
```

## Layout

```
index.html              entry (fonts from jsDelivr: Pretendard, SF Mono)
public/                 copied as-is: manifest, icons, sw.js (offline), CNAME
src/
  main.tsx              providers, service-worker registration
  App.tsx               two screens: home and add
  types.ts              Entry, Group, Unit, persisted state
  state/store.tsx       reducer + context, persisted to localStorage ("expiry.v1")
  hooks/                toast, hash route (#add), keyboard inset, bottom-bar height, entry actions
  lib/                  pure logic: dates, weight, grouping, import, export, storage, excel/ (zip, build, parse)
  components/
    home/               HomeView, ItemGroup, EntryRow
    add/                AddView, Step, RecentList
    common/             BottomBar, RowMenu (edit/delete sheet), UnitPicker, Icons
  styles/               tokens, base, chrome, home, add, sheet, responsive
```

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` typechecks, tests, builds and publishes `dist/` on every push to the deploy branch. In the repository settings, Pages → **Build and deployment → Source** must be **GitHub Actions**. The custom domain is set under Pages → Custom domain (`expiry.jeehoo.im`); `public/CNAME` keeps it in the build output.

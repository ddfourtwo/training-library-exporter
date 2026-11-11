# Training Library Exporter

A browser extension that downloads **your own** TrainingPeaks workout libraries and
training plans to a single JSON file.

It reads TrainingPeaks with the session you are already signed in with, writes one
file to your downloads, and stops there. Nothing is uploaded anywhere, and there is
no account to create.

Works with TrainingPeaks. The file it writes is a documented format any training
application can read — see [The export file](#the-export-file).

- MIT licensed
- No server, no telemetry, no analytics, no third-party requests
- Read-only: the extension only ever `GET`s from TrainingPeaks

## What it does

1. You sign in to TrainingPeaks as usual.
2. You tick the libraries and plans you want.
3. You get `training-library-export-YYYY-MM-DD.json` in your downloads.

The file holds the libraries and plans **exactly as TrainingPeaks returned them** —
no field selection, no renaming, no summarising. That is deliberate: whoever reads
the file maps it with their own TrainingPeaks mapping, so an exporter that
"helpfully" reshaped rows would quietly become the place where training data is
lost.

## Install (development build)

Chrome, Edge, Brave or any Chromium browser:

```bash
npm install
npm run build
```

Then open `chrome://extensions/`, switch on **Developer mode**, click **Load
unpacked** and pick the `dist` folder.

## Use

1. Click the extension icon, then **Open TrainingPeaks** if asked. The extension
   picks up the session TrainingPeaks itself is using — it never asks for your
   password and cannot read it.
2. Pick libraries, plans, or both.
3. Click **Export**, confirm that you own the content, and the file is saved.

Exports are read-only and repeatable: running one again writes another file and
changes nothing in TrainingPeaks.

## The export file

```jsonc
{
  "format": "training-library-export",
  "version": 1,
  "exported_at": "2026-11-11T09:15:00.000Z",
  "libraries": [
    {
      "library": { "id": 123456, "name": "Bike: threshold" },
      "items": [
        /* raw rows from /exerciselibrary/v2/libraries/{id}/items */
      ],
    },
  ],
  "plans": [
    {
      "plan": {
        /* raw row from /plans/v1/plansWithAccess */
      },
      "workouts": [
        /* raw rows from /plans/v1/plans/{id}/workouts/{start}/{end} */
      ],
      "notes": [
        /* raw rows from /plans/v1/plans/{id}/calendarNote/{start}/{end} */
      ],
      "plan_first_day": "2022-03-07",
    },
  ],
}
```

The machine-readable contract is
[`schema/training-library-export.schema.json`](schema/training-library-export.schema.json)
(JSON Schema 2020-12). Every build is checked against it in the test suite.

`plan_first_day` is the only field that is ours rather than TrainingPeaks': the
earliest `workoutDay` in the plan. A plan is a sequence of weeks relative to its own
first day, so a reader that stores plans on absolute dates needs that anchor to
place them on the week 1 the coach picks when importing.

A reader **must** reject a file whose `format` or `version` it does not implement.
`version` is bumped only for a breaking change to the envelope.

## Permissions

| Permission                                                                            | Why                                                                         |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `host_permissions` on `app.trainingpeaks.com` and `app.sandbox.trainingpeaks.com`     | Read the session TrainingPeaks is already using, so you don't sign in twice |
| `host_permissions` on `tpapi.trainingpeaks.com` and `tpapi.sandbox.trainingpeaks.com` | Read your libraries and plans                                               |
| `storage`                                                                             | Remember the captured TrainingPeaks session                                 |
| `tabs`                                                                                | Open TrainingPeaks in a background tab to refresh a session that expired    |

There is no `downloads`, no `webRequest`, no `scripting` and no optional host.

## Privacy

[PRIVACY.md](PRIVACY.md) describes exactly what is read, where it goes (a file on
your disk) and what is kept. In short: your training data never leaves your browser.

## Development

```bash
npm run dev          # Vite dev server + HMR popup
npm run type-check   # tsc --noEmit
npm run lint         # eslint
npm run test:unit    # vitest
npm run build        # production bundle in dist/
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit and
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Layout

```
src/
  background/   Service worker: TrainingPeaks API client, export assembly
  content/      TrainingPeaks token capture (MAIN + ISOLATED worlds)
  export/       The export file: format, assembly, naming
  hooks/        React Query hooks and popup state
  popup/        The popup UI
  schemas/      Zod schemas for every TrainingPeaks response
  services/     Auth, storage, debug logs
  utils/        Constants, dates, errors
schema/         The published JSON Schema
tests/          Unit, component and end-to-end tests
```

## Licence

MIT — see [LICENSE](LICENSE).

TrainingPeaks is a trademark of TrainingPeaks, LLC. This project is not affiliated
with, endorsed by or supported by TrainingPeaks.

# Architecture

The extension reads a coach's own TrainingPeaks data with the session TrainingPeaks
is already using, and writes it to one file. There is no server and no other
destination.

## The pieces

```
TrainingPeaks web app (you signed in)
  -> content/   captures the session token
  -> background/  reads tpapi with that token, assembles the export file
  -> popup/     writes the file to disk
```

- **`src/content/`** runs on `app.trainingpeaks.com` only.
  `mainWorldInterceptor.ts` (MAIN world) watches the page's own requests for the
  bearer token; `isolatedWorldBridge.ts` (ISOLATED world) forwards it to the
  background. Nothing on a third-party page can drive the extension.
- **`src/background/`** is the only place that talks to the TrainingPeaks API
  (`api/trainingPeaks.ts`) and the only place that holds the session.
  `libraryExport.ts` reads the selected sources and assembles the file.
  `messageHandler.ts` is the single router for popup messages.
- **`src/export/`** owns the file itself: `sources.ts` (what was selected),
  `libraryExportFile.ts` (format, assembly, naming). The published JSON Schema in
  `schema/` is the contract; this module is the only writer of it.
- **`src/popup/`** is the UI. It never touches the TrainingPeaks API: it asks the
  background for the file and saves it.

## Why the file is assembled in the background

Host permissions and the captured session live in the service worker, and the
popup can be closed at any moment. The background does the reading; the popup only
turns the finished object into a download, which needs a document.

## Why TrainingPeaks rows are passed through untouched

`items`, `workouts` and `notes` hold the rows `response.json()` produced, with no
field selection, no renaming and no validation beyond "is it a list". The picker's
Zod projections are for rendering and never become file content.

The reason is that the mapping from TrainingPeaks rows to another system's model
belongs to that system. An exporter that reshapes rows becomes a silent second
mapper, and the day the two disagree the training data is wrong without anyone
being told.

`plan_first_day` is the one field we add: the earliest `workoutDay` in the plan.

## Message flow

| From | Message | Effect |
| --- | --- | --- |
| content | `TOKEN_FOUND` | Store the captured TrainingPeaks session |
| popup | `GET_USER`, `GET_LIBRARIES`, `GET_LIBRARY_ITEMS`, `GET_TRAINING_PLANS`, `GET_PLAN_WORKOUTS`, `GET_PLAN_NOTES`, `GET_PLAN_EVENTS` | Read-through to the TrainingPeaks API |
| popup | `START_LIBRARY_EXPORT` | Read every selected source and return the assembled file |
| popup | `REFRESH_PROVIDER_AUTH` | Open a background tab so the coach can re-capture an expired session |
| popup | `GET_DEBUG_LOGS`, `CLEAR_DEBUG_LOGS` | The in-popup API metadata log |

`START_LIBRARY_EXPORT` is refused unless it comes from an extension page
(`sender.tab` is undefined), so no web page can start an export.

## Storage keys

`chrome.storage.local` only.

| Key | Meaning |
| --- | --- |
| `auth_token` | The captured TrainingPeaks bearer token |
| `token_timestamp` | When it was captured |
| `trainingpeaks_environment` | `production` or `sandbox` |
| `trainingpeaks_api_logs` | Ring buffer of API call metadata (no bodies) |

## Environments

Settings offers TrainingPeaks **production** and **sandbox**. Sandbox calls go to
`tpapi.sandbox.trainingpeaks.com` with the sandbox app origin, so a sandbox session
never carries a production origin. Switching environment clears the captured token
and cached data, because both belong to the previous environment.

## Testing

- `tests/unit/` — modules, in jsdom with `chrome` stubbed (`tests/setup.ts`)
- `tests/components/` — popup components rendered with Testing Library
- `tests/e2e/` — Playwright against a loaded build

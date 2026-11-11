# Privacy

> Describes what the code does today. It is not a legal document.

Training Library Exporter reads your own TrainingPeaks workout libraries and
training plans and writes them to one JSON file in your browser's downloads. That
is the whole data path.

## What it reads

- Your TrainingPeaks session token, from the TrainingPeaks web app you are signed
  in to. It is stored in `chrome.storage.local` on your machine.
- The library list, the items of the libraries you pick, the plan list, and the
  workouts and calendar notes of the plans you pick — read with that session,
  using `GET` only.
- Your TrainingPeaks name, to show which account is connected.

## Where it goes

To a file on your disk, and nowhere else.

- **No server of ours.** The extension has no backend, and there is no account.
- **No third-party requests.** The only hosts it ever contacts are
  `app.trainingpeaks.com`, `tpapi.trainingpeaks.com` and their sandbox
  equivalents.
- **No telemetry, analytics, crash reporting or advertising.**

## What it stores

In `chrome.storage.local`, on your machine only:

- Your TrainingPeaks session token and when it was captured
- The TrainingPeaks environment selection (production or sandbox)
- A ring buffer of API call *metadata* for the in-popup debug log: endpoint,
  status, timing, error code. **Not** request bodies or response bodies.

Uninstalling the extension removes all of it.

## What the exported file contains

The libraries and plans you picked, as TrainingPeaks returned them. A plan's
workouts carry the athlete identifier and any athlete-entered comments
TrainingPeaks includes, because the file is a faithful copy of what the API
returned. Treat the file as private training data. Nobody else receives it unless
you upload it somewhere yourself.

## Permissions

See the table in [README.md](README.md#permissions) and the engineering detail in
[docs/PRIVACY_AND_PERMISSIONS.md](docs/PRIVACY_AND_PERMISSIONS.md).

## TrainingPeaks

Using this extension is subject to TrainingPeaks' own terms. It reads the account
you are signed in to, so only export content you own or are authorised to export.
The dialog asks you to confirm that before every export.

This project is not affiliated with, endorsed by or supported by TrainingPeaks.

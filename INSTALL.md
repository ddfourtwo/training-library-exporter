# Install

## From a build (Chromium browsers)

1. `npm install && npm run build`
2. Open `chrome://extensions/` (or `edge://extensions/`, `brave://extensions/`)
3. Switch on **Developer mode**
4. Click **Load unpacked** and select the `dist` folder
5. Pin the extension so the icon stays visible

The extension has no installer, no account and no configuration file. To update,
`npm run build` again and click the reload arrow on the extension card.

## First run

1. Click the icon.
2. The popup asks you to **Open TrainingPeaks**. Do that and sign in as usual. The
   extension reads the session TrainingPeaks is already using; it never asks for
   your password and cannot see it.
3. Go back to the popup. Your libraries and plans are listed.

If the popup still says you are not signed in after signing in to TrainingPeaks,
reload the TrainingPeaks tab once: the token is captured from a request the page
makes after load.

## Export

1. Tick the libraries and plans you want. You can select several of each.
2. Click **Export**, then confirm that you own the content or are authorised to
   export it.
3. `training-library-export-YYYY-MM-DD.json` lands in your downloads.

Nothing is uploaded. The file is written locally and the extension forgets about
it immediately.

## Choose the TrainingPeaks environment

Only needed if you work against the TrainingPeaks sandbox.

1. Open **Settings**.
2. Pick **Production** (default) or **Sandbox**.
3. Sign in to that environment; the captured session belongs to one environment.

## Troubleshooting

### "TrainingPeaks authentication is required"

The captured session expired or was never captured.

- Open TrainingPeaks and sign in again, then reopen the popup
- Or press **Refresh TrainingPeaks sign-in** in the popup, which does it in a
  background tab

### The export stops on one library or plan

The export is all-or-nothing: a file missing one of the libraries you ticked looks
complete and is not. The error names the source that failed. Retry it; if it keeps
failing, that library or plan is not readable with your account.

### Nothing is in my downloads

Check the browser's download settings for `*.json`. Chrome asks once per file type
where to save; a blocked prompt saves nothing.

### Diagnostics

Settings has an API log: endpoint, status, timing and error code, never response
bodies. **Copy diagnostic report** in an error panel copies the extension version,
browser and platform — no training data.

# Testing Guide

This project has unit, component, and Playwright-based extension tests, plus a
small set of manual smoke checks that are important for auth and export flows.

## Automated Checks

Run the standard validation commands before opening a pull request:

```bash
npm run lint
npm run type-check
npm run test:unit
```

Additional commands:

```bash
npm test
npm run test:components
npm run coverage
npm run test:e2e
```

## Build Notes

For local validation, prefer:

```bash
npm run build:bundle
```

`npm run build` increments the patch version in
`package.json` and `public/manifest.json`. That is useful for release packaging
but noisy during normal development.

## Manual Smoke Tests

### 1. TrainingPeaks Auth Capture

1. Load the extension in Chrome.
2. Sign in to `https://app.trainingpeaks.com`.
3. Navigate inside the app, or click **Refresh** in the popup (this opens a
   temporary background tab and closes it; your own tab must stay untouched).
4. Open the popup.
5. Confirm that TrainingPeaks shows as connected.

### 2. Library and Plan Browsing

1. Open a connected popup.
2. Load workout libraries and at least one library detail view.
3. Load training plans if your account has them.
4. Confirm that notes, events, and structured workout details render without
   obvious errors.

### 3. Export Flow

1. Select a small library (and, separately, a plan) and click **Export**.
2. Confirm the file lands in Downloads and the result panel shows the library,
   plan and workout counts.
3. Validate the file against `schema/training-library-export.schema.json`; it must
   pass with no errors.
4. Export the same selection again and confirm a second file is written and
   nothing in TrainingPeaks changed.
5. Sign out of TrainingPeaks and confirm the popup sends you to sign in again
   rather than writing a half-empty file.

## Playwright E2E Notes

- Extension tests must run in headed Chromium
- Build the extension before running E2E tests
- Use `npx playwright install chromium` if the browser is not installed yet

See [tests/e2e/README.md](./tests/e2e/README.md) for Playwright-specific
details.

## Suggested Pre-PR Checklist

- `npm run lint`
- `npm run type-check`
- `npm run test:unit`
- `npm run build:bundle`
- Relevant manual smoke tests for the feature you changed

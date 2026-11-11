# Privacy and permissions: engineering detail

> Engineering description of exactly what the extension reads, keeps and can
> reach. Product-level version: [../PRIVACY.md](../PRIVACY.md).

## Network

| Host | Purpose |
| --- | --- |
| `app.trainingpeaks.com` | The TrainingPeaks web app: content script captures the session token from its own requests |
| `tpapi.trainingpeaks.com` | The TrainingPeaks API: read libraries, plans, workouts, notes |
| `app.sandbox.trainingpeaks.com` | The above, when the sandbox environment is selected |
| `tpapi.sandbox.trainingpeaks.com` | The above, when the sandbox environment is selected |

No other host is contacted. There is no backend, no analytics and no crash
reporting. The exported file is written to the local disk and never sent anywhere.

## Storage

`chrome.storage.local`:

| Key | Contents |
| --- | --- |
| `auth_token` | TrainingPeaks bearer token |
| `token_timestamp` | Capture time |
| `trainingpeaks_environment` | `production` or `sandbox` |
| `trainingpeaks_api_logs` | Ring buffer of call metadata: endpoint, method, status, duration, error code. No request or response bodies, no headers |

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Persist the captured session and the environment choice |
| `tabs` | Open TrainingPeaks in a **background** tab to re-capture an expired session, and focus it if intervention is needed |
| `host_permissions` (four TrainingPeaks origins) | Call the TrainingPeaks API with the captured session; inject the token-capture scripts |

Not requested: `downloads` (the popup saves the file with an object URL),
`webRequest`, `scripting`, `cookies`, `history`, `<all_urls>`, optional hosts,
remotely hosted code.

## Content scripts

| Script | Matches | World | Purpose |
| --- | --- | --- | --- |
| `mainWorldInterceptor.ts` | the two TrainingPeaks app origins | `MAIN` | Observe the page's own requests for its bearer token |
| `isolatedWorldBridge.ts` | the two TrainingPeaks app origins | `ISOLATED` | Forward the captured token to the background |

There is no content script on any other site.

## Read-only

Every TrainingPeaks request the extension makes is a `GET`. It cannot create,
modify or delete anything in a TrainingPeaks account.

## The export file

Contains the selected libraries and plans exactly as the API returned them,
including the athlete identifier and athlete-entered fields TrainingPeaks includes
on a plan workout. It is written to the local disk only. The coach decides what to
do with it next; the extension neither uploads it nor remembers where it went.

## Debug log

The in-popup debug log shows API call metadata so a coach can tell a rate limit
from an expired session. It never holds response bodies, request bodies or headers,
which is why it is safe to copy into a bug report.

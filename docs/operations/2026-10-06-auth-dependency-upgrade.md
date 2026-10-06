# Login timeout and dependency upgrade

## Cause

On October 6, 2026, the production `beforesignedin-00007-zuy` revision returned
HTTP 200 after **7.855840742 seconds**. Its instance started at 17:49:31.166 UTC
and passed its startup probe at 17:49:38.629 UTC. Firebase Authentication's
blocking-hook deadline is **seven seconds**, including the wait for the service.
The successful late response explains `auth/internal-error` with
`Cloud function deadline exceeded` on the login form. The affected email was
present in the live `betaAllowlist`; this was not an invitation rejection.

The Functions entry point imported all trigger groups, loading native font
parsing/rendering and AI modules into the authentication container. The allowlist
read also had no application deadline, and lookup failures were reported as
invitation denials.

## Changes

- Load only the deployed function's trigger group using `FUNCTION_TARGET`.
  Local module startup fell from 1,159 ms to 170 ms; auth loads no font/native
  modules. CLI discovery still finds all 12 existing functions.
- Prefer Firestore REST transport, keep the live 30-second invite cache, and
  bound invite reads at 2.5 seconds. A failed or timed-out read denies access
  with a temporary-unavailable error. A late response cannot populate the cache.
- Keep all three auth hooks in `us-central1`, with 512 MiB, one CPU,
  a seven-second request timeout, and zero minimum instances.
- Translate wrapped `auth/internal-error` into useful login copy while
  preserving the specific closed-beta rejection message.
- Upgrade direct app and Functions dependencies to current stable releases;
  update security overrides, lockfiles, CI actions, and runtime configuration.
  Remove unused legacy Vertex AI / AI Platform SDK dependencies.

| Package/runtime | Version |
| --- | --- |
| Node | 24.21.0 locally; `nodejs24` on Cloud Functions; Node 24 Docker base |
| npm | 12.2.0 |
| Next / eslint-config-next | 16.3.8 |
| React / React DOM | 19.3.0 |
| Firebase web | 12.19.0 |
| Firebase Admin | 14.5.0 |
| Firebase Functions | 7.4.0 |
| Google Cloud Tasks | 7.2.1 |
| Google Gen AI | 2.27.0 |
| Motion / Framer Motion | 14.0.0 |
| DialKit | 2.0.2 |
| TypeScript CLI | 7.0.2 |
| Firebase deployment CLI | 15.32.1 |

ESLint remains at the latest compatible 9.x release, 9.39.5: Next's current
`eslint-plugin-react@7.37.5` does not support ESLint 10. The web app uses
Microsoft's recommended aliases: TypeScript 7 for `tsc`, and the TypeScript 6
compatibility package for Next/ESLint's compiler API. Node types use the latest
24.x declarations to match the deployed runtime. Cloud Functions reports Node
26 as beta, so Node 24 is the newest stable supported runtime.

## Verification

The release checkout starts at production branch `46ff9fd`, preserving its
event-driven import pipeline and excluded unit-test infrastructure. The primary
checkout's unrelated unfinished search changes are not part of the release.

- Web lint, secret scan, TypeScript 7 check, and production build passed.
- Functions lint and TypeScript 7 build passed.
- Auth verification covered cache normalization/expiry, missing and uninvited
  emails, store errors, the 2.5-second deadline, late-read cache safety, wrapped
  error copy, module isolation, and discovery of all existing handlers.
- Production web dependency audit: zero advisories. Functions audit: zero
  advisories. Full web audit: five high entries from one unpatched `braces`
  advisory in Next's development ESLint dependency chain. `braces@3.0.3` is
  still its latest release; downgrading Next's lint configuration is not a fix.
- All three auth hooks deployed successfully on Node 24. A real cold-start
  sign-in hook returned HTTP 200 in **2.713120023 seconds** (previously 7.8558 s).
  The full Firebase REST sign-in round trip was 3,348 ms, then 362 ms when warm.
  Uninvited sign-in and signup were rejected, and invited signup succeeded.
  All three temporary Auth users and both temporary invitation documents were
  deleted after verification. No reset emails were sent.
- Vercel production deployment `dpl_4juBYhNHpkNnAXDDSF12UUEyJD2N` is ready
  and aliased to `https://seriph.naw.al`; its build completed with Next 16.3.8.
  The browser rendered the login form successfully.
- Archive worker image build `6cdb671c-4ecb-4af6-9b19-3427b817ba6d` succeeded;
  revision `seriph-archive-worker-00004-c6q` serves 100% of traffic with the
  new Node 24 image pinned by digest.
- All 12 existing Cloud Functions are ACTIVE on `nodejs24`; all nine remaining
  function updates completed successfully.
- Live authenticated `/api/v1/families`, `/api/v1/search-index`, and the search
  function returned HTTP 200. Unauthenticated app API/search requests returned
  HTTP 401. The font CDN returned HTTP 200 with `@font-face` CSS.
- The private archive worker rejected anonymous requests with HTTP 403, and an
  authorized request with missing task metadata returned its expected HTTP 400.
  The upgraded Cloud Tasks SDK read the RUNNING `seriph-import` queue.
- These smoke checks cover login, API authentication, SDK initialization, and
  service readiness. A full font-upload/enrichment/import workload was not run.

## Sources

- [Firebase blocking-function deadline and error wrapping](https://firebase.google.com/docs/auth/extend-with-blocking-functions)
- [Firebase cold-start dependency guidance and Firestore REST example](https://firebase.google.com/docs/functions/tips)
- [Supported Cloud Functions runtimes](https://docs.cloud.google.com/functions/docs/runtime-support)
- [TypeScript 7 side-by-side compatibility packages](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [Motion upgrade guide](https://motion.dev/docs/upgrade-guide)
- [Development-only braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)

# Seriph TODO Backlog

## 🔥 Immediate Recovery (blockers before any deploy)
- [x] Pin `next`, `react`, `firebase`, and other `latest` dependencies to explicit versions; commit updated `package-lock.json`.
- [x] Restore ESLint toolchain (`eslint`, `eslint-config-next`, project `.eslintrc.json`) so `npm run lint` succeeds.
- [x] Update `tsconfig.json` to exclude `.next/**` and add a root `npm run typecheck`.
- [x] Create `.env.example` documenting every variable required for web, API routes, and Firebase functions.
- [x] Re-implement lost API routes (`app/api/families/*`, `app/api/share`) or gate code paths defensively until restored.

## ✅ Quality + CI Foundations
- [x] Add minimal unit tests (Vitest/Jest) for shared utilities (`utils/normalize`, Firestore helpers).
- [x] Configure Firebase Functions lint/type-check commands (`npm run lint --prefix functions`, `npm run test --prefix functions`).
- [x] Introduce GitHub Actions workflows (`web-ci.yml`, `functions-ci.yml`) running install → lint → typecheck → test → build.
- [x] Document local developer workflow and pipeline expectations in `README.md`.

## 🚀 Future Enhancements
- [ ] Add integration tests for upload flow (mock Storage + Firestore via emulator).
- [ ] Automate preview/production deploys (Vercel + Firebase) behind manual approvals.
- [ ] Implement dependency update policy (Renovate/Dependabot) once versions are pinned.
- [ ] Add performance/error monitoring instrumentation notes (Sentry, Log-based alerts) to ops docs.

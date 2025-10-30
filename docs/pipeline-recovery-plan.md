# Seriph Pipeline Recovery Plan

## 1. Context Recap
- **Product focus**: Next.js 15 app (app router) for managing font families, backed by Firebase Auth, Firestore, and Storage. Uploads go through `app/api/upload/route.ts` and Cloud Functions in `functions/src`.
- **Current toolchain**: Node 22, TypeScript, Tailwind. No automated tests, linting fails, and there is no CI/CD automation in the repo.
- **Consequences of lost commits**: Critical API routes referenced by generated `.next` types (`app/api/families/...`, `app/api/share/...`) are missing; the README reverted to the default scaffold; workflows/config that previously enforced quality have disappeared.

## 2. Observed Issues (from code + command review)
- `npm run lint` fails immediately (`next lint` believes `lint` is a directory) because ESLint packages/config were removed. Pipelines cannot gate on linting until this is restored.
- `npx tsc --noEmit` surface errors inside `.next/types/**` pointing to missing API routes. `tsconfig.json` currently includes `.next/**/*`, so type-checking is impossible without either restoring those routes or fixing the config.
- Dependencies in `package.json` are set to `latest`. Builds will randomly break as upstream releases ship breaking changes; CI needs deterministic versions.
- No test runner or sample tests exist for either the Next app or Firebase functions—pipelines cannot validate behaviours.
- There is no GitHub Actions (or alternative) workflow folder. Deployments/builds/tests are completely manual today.
- Firebase Functions rely on heavy AI SDKs; without caching/parallelism controls, CI runtimes will be slow unless dependencies are pruned or cached intelligently.
- Secrets & env management: `.env.local` is used in development, but there is no documented mapping to CI/production secrets (Firebase, upload tokens, etc.).

## 3. Recovery Strategy
### Stage 0 – Repo hygiene
- Restore human-facing docs: update `README.md` with true project summary, architecture overview, and environment expectations.
- Audit `.env.local` entries, define canonical env variable list, and add `.env.example` for onboarding + CI reference.

### Stage 1 – Toolchain Stabilisation
- Pin `next`, `react`, `firebase` client SDK, and other dependencies to known-good versions; rerun `npm install` to refresh `package-lock.json`.
- Add `eslint`, `@typescript-eslint/*`, and `eslint-config-next` to devDependencies. Recreate `.eslintrc.json` with project rules.
- Split lint scripts: `lint:web`, `lint:functions` (using `eslint` with root + functions rules). Keep `npm run lint` as aggregator.
- Adjust `tsconfig.json` to exclude `.next/**`; add a dedicated `npm run typecheck`.
- For Firebase functions, add a parallel `functions/eslint` config or at minimum a `tsc --noEmit` script.

### Stage 2 – Quality Gates
- Introduce a lightweight test harness (Vitest or Jest) for shared utility code (`utils/normalize`, Firestore helpers). Add at least one high-signal test per domain to prevent regressions.
- For functions, wire up `firebase-functions-test` with minimal smoke tests (e.g., parser utils) to keep deployable state verifiable.
- Document local commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and the equivalent `functions` scripts. Add them to README and contribution guide.

### Stage 3 – CI/CD Pipeline
- **Workflow layout** (`.github/workflows`):
  1. `web-ci.yml` – triggers on PRs/pushes to main. Jobs: `setup-node@v4` (Node 22), `npm ci`, cache `.next` + `node_modules`, run `npm run lint`, `npm run typecheck`, `npm run test` (if added), `npm run build`. Upload `.next/trace` artifacts for debugging.
  2. `functions-ci.yml` – uses matrix for Node 22, runs `npm ci --prefix functions`, `npm run lint --prefix functions` (once added), `npm test --prefix functions`, `npm run build --prefix functions`. Cache `functions/node_modules`.
  3. Optional deploy workflow gated on tags/manual dispatch that runs the above jobs and, if green, triggers Vercel/Firebase deploys via CLI or API (ensure secrets are stored as GitHub Actions secrets).
- Implement concurrency settings to cancel superseded runs (`concurrency.group: ${{ github.ref }}`) to save build minutes.
- Ensure secret management: map Firebase service account JSON, upload tokens, and API keys into GitHub Actions secrets; never rely on `.env.local`.

### Stage 4 – Missing Code Restoration
- Recreate the lost API routes (`app/api/families/[familyId]/route.ts`, etc.) or refactor client code to remove dead references. Until then, mark TODOs in code and tests so pipelines surface failures rather than silently breaking.
- Confirm Firebase indexes/rules align with Firestore queries (`orderBy` + `where`). Re-run `firebase firestore:indexes` after the restore.

## 4. Suggested Timeline
1. **Day 1–2**: Pin dependencies, restore ESLint & typecheck scripts, create `.env.example`, update README.
2. **Day 3**: Implement basic tests, fix missing API stubs (or guard code), ensure local commands succeed.
3. **Day 4**: Commit GitHub Actions workflows; run against feature branch; iterate until green.
4. **Day 5+**: Expand test coverage, add preview deployments, and automate Firebase deploys.

## 5. Coordination Checklist (mirror in `TODO.md`)
- [ ] Lock dependency versions & regenerate `package-lock.json`.
- [ ] Re-add ESLint config and ensure `npm run lint` passes locally.
- [ ] Add `npm run typecheck` and ensure `.next` is excluded.
- [ ] Introduce unit tests for core utilities + Firestore helpers.
- [ ] Set up GitHub Actions workflows for web + functions.
- [ ] Restore missing API route handlers or remove dead references.
- [ ] Document env vars and developer workflow in README.

This plan assumes git history cannot be resurrected and focuses on re-establishing deterministic builds, strong local feedback loops, and automated CI enforcement.

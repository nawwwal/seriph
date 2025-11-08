# Deployment Guide

## Quick Start

```bash
# 1. Install dependencies
cd functions && npm install

# 2. Build TypeScript
npm run build

# 3. Deploy
cd .. && firebase deploy --only functions
```

**Before deploying:** Configure Remote Config parameters (see below).

---

## Prerequisites

- Firebase CLI: `npm install -g firebase-tools && firebase login`
- Node.js 22+
- Vertex AI API enabled in your Firebase project
- Service account JSON (for local emulator only)

---

## Configuration

### Remote Config (Required)

All AI pipeline settings are controlled via Firebase Remote Config. 

**Option 1: CLI (Recommended)**
```bash
# First, authenticate (choose one):
# Option A: Use gcloud (recommended)
gcloud auth application-default login

# Option B: Use Firebase CLI
firebase login

# Option C: Use service account
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Then set up all parameters at once
node scripts/setup-remote-config.js YOUR_PROJECT_ID

# Or use Firebase CLI to download/edit/publish manually
firebase remoteconfig:get --project YOUR_PROJECT_ID > remote-config.json
# Edit remote-config.json, then:
firebase remoteconfig:publish --project YOUR_PROJECT_ID remote-config.json
```

**Option 2: Firebase Console**
Set these in **Firebase Console → Remote Config**:

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `is_vertex_enabled` | Boolean | `false` | Kill switch; set `true` in staging, `false` in prod until launch |
| `web_enrichment_enabled` | Boolean | `false` | Enable Google Search grounding |
| `web_enrichment_cache_ttl_days` | Number | `30` | Cache TTL for web enrichment results (Firestore `_web_enrichment_cache`) |
| `vertex_location_id` | String | `asia-southeast1` | Vertex AI region |
| `visual_analysis_model_name` | String | `gemini-2.5-flash` | Stage 1 model |
| `enriched_analysis_model_name` | String | `gemini-2.5-flash` | Stage 2 model |
| `enriched_analysis_fallback_model_name` | String | `gemini-2.5-flash` | Fallback model |
| `web_enricher_model_name` | String | `gemini-2.5-flash` | Web enrichment model |
| `summary_model_name` | String | `gemini-2.5-flash` | Summary generation model |
| `ai_max_output_tokens` | Number | `1536` | Max tokens per response |
| `ai_temperature` | Number | `0.4` | Generation temperature |
| `ai_top_p` | Number | `0.9` | Top-p sampling |
| `ai_top_k` | Number | `40` | Top-k sampling |
| `ai_max_concurrent_ops` | Number | `4` | Concurrent AI operations |
| `ai_retry_max_attempts` | Number | `3` | Max retries for transient errors |
| `ai_retry_base_ms` | Number | `250` | Base retry delay (ms) |
| `ai_retry_max_ms` | Number | `4000` | Max retry delay (ms) |
| `ai_confidence_band_thresholds` | String | `0.2,0.6,0.85` | CSV thresholds for confidence bands |
| `optical_range_pt_thresholds` | String | `9,18,36` | CSV pt thresholds for optical size buckets |
| `unprocessed_bucket_path` | String | `unprocessed_fonts` | Storage path for uploads |
| `processed_bucket_path` | String | `processed_fonts` | Storage path for processed fonts |
| `failed_bucket_path` | String | `failed_processing` | Storage path for failures |
| `ai_count_tokens_enabled` | Boolean | `false` | Log token usage metadata (use in staging only) |

**Note:** Changes to Remote Config take effect immediately (no redeploy needed).

### Environment Variables

#### Local Development

**Root `.env.local`** (Next.js app):
```bash
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
FIREBASE_ADMIN_PROJECT_ID="..."
FIREBASE_ADMIN_CLIENT_EMAIL="..."
FIREBASE_ADMIN_PRIVATE_KEY="..."
```

**`functions/.env.local`** (Cloud Functions emulator):
```bash
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

#### Production

**Next.js (Vercel):** Set Firebase client/admin vars in Vercel Dashboard.

**Cloud Functions:** No env vars needed. All config via Remote Config. `GOOGLE_CLOUD_PROJECT` is set automatically by Firebase.

**Do NOT set:**
- ❌ `GOOGLE_CLOUD_PROJECT` (auto-set by Firebase)
- ❌ `GOOGLE_APPLICATION_CREDENTIALS` (production only; local emulator only)
- ❌ `GEMINI_WEB_SEARCH_ENABLED` (use RC `web_enrichment_enabled`)
- ❌ `MAX_CONCURRENT_AI_OPS` (use RC `ai_max_concurrent_ops`)
- ❌ `GOOGLE_CLOUD_LOCATION` (use RC `vertex_location_id`)

---

## IAM Permissions

### Get Service Account

```bash
PROJECT_ID=your-project-id
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

### Grant Permissions

**Vertex AI:**
```bash
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user"
```

**Cloud Storage:**
```bash
BUCKET_NAME="${PROJECT_ID}.appspot.com"
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin gs://${BUCKET_NAME}
```

**Or use the script:**
```bash
./scripts/fix-storage-permissions.sh [project-id]
```

---

## Enable APIs

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  cloudfunctions.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com
```

---

## Local Testing

```bash
# Start emulators
firebase emulators:start --only functions,firestore,storage

# Upload test font to unprocessed_fonts/ in emulator storage
# Check logs and Firestore metrics_ai/{processingId} for timings
```

### Run Tests

```bash
cd functions
npm test  # runs Vitest suite (parser, validation, taxonomies, integration)
```

---

## Deploy

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

**Verify:**
```bash
firebase functions:log --only processUploadedFontStorage
```

### Test/Utility HTTP Functions

These are intended for staging and admin-only usage.

- `testFontPipeline` (POST): Run the AI pipeline on an ad-hoc font payload.

Request body:
```json
{
  "base64": "AA...==",
  "filename": "MyFont.ttf"
}
```
or
```json
{
  "url": "https://example.com/path/to/font.ttf",
  "filename": "font.ttf"
}
```

- `batchReprocessFonts` (POST): Re-run pipeline for existing families.

Request body:
```json
{
  "ownerId": "user_uid",          // optional
  "familyIds": ["family-id-1"],   // optional
  "limit": 10,                    // optional, default 10, max 50
  "force": false                  // optional
}
```

Secure access via IAM and keep enabled only in staging environments.

---

## Troubleshooting

### Build Errors
```bash
cd functions
rm -rf lib node_modules
npm install && npm run build
```

### "GOOGLE_CLOUD_PROJECT is reserved"
- **Fix:** Remove `GOOGLE_CLOUD_PROJECT` from Firebase Console → Functions → Environment Variables
- **Why:** Firebase sets this automatically

### "Permission denied" (Storage)
- **Fix:** Run `./scripts/fix-storage-permissions.sh [project-id]`
- **Verify:** `gsutil iam get gs://${BUCKET_NAME} | grep ${SERVICE_ACCOUNT}`

### "Permission denied" (Vertex AI)
- **Fix:** Grant `roles/aiplatform.user` to service account (see IAM section)

### "Model not found"
- **Check:** RC `vertex_location_id` supports the model (e.g., `asia-southeast1` for Gemini 2.5 Flash)
- **Check:** Vertex AI API is enabled
- **Check:** RC model names are valid (e.g., `gemini-2.5-flash`)

### Web search not working
- **Check:** RC `web_enrichment_enabled` is `true`
- **Check:** Model supports web search (Gemini 2.5 Flash does)

---

## Monitoring

**View logs:**
```bash
firebase functions:log --only processUploadedFontStorage
```

**Check metrics:**
- Firestore: `metrics_ai/{processingId}` (per-run timings, token usage)
- Firestore: `_rateLimits/global` (concurrency tracking)
- Firestore: `_web_enrichment_cache/{fingerprint}` (web enrichment cache with TTL)

**Cost monitoring:**
- Google Cloud Console → Billing → Set budget alerts for Vertex AI

### Billing Alerts (Vertex AI)
1. Open Google Cloud Console → Billing → Budgets & alerts.
2. Create budget:
   - Scope: This project
   - Products: Vertex AI
   - Amount: Choose monthly budget threshold (e.g., $50)
3. Alerts:
   - Add thresholds (e.g., 50%, 90%, 100%)
   - Notification channel: Email and/or Slack (via Pub/Sub → Cloud Function → Slack webhook)
4. Save. Confirm emails are received when crossing thresholds.

---

## Production Checklist

- [ ] Remote Config parameters set (especially `is_vertex_enabled=false` until launch)
- [ ] IAM permissions granted (Vertex AI + Storage)
- [ ] APIs enabled
- [ ] Functions deployed
- [ ] Test upload works end-to-end
- [ ] Logs show pipeline execution
- [ ] Monitoring/alerts configured

---

## Staged Rollout with Remote Config

Use Firebase Remote Config conditions to enable the AI pipeline for a subset of users before full rollout.

1. Define conditions:
   - Condition A: `is_test_user` (user property or email domain)
   - Condition B: `rollout_10`, `rollout_50` (percent audiences)
2. Parameters:
   - `is_vertex_enabled`:
     - Default: `false` (kill switch)
     - Condition A: `true` (enable for test users)
     - Condition B: `true` (enable for 10% → 50% → 100%)
   - `web_enrichment_enabled`:
     - Default: `false`
     - Enable only after stability is confirmed
3. Rollout Phases:
   - Phase 1: Test users only
   - Phase 2: 10% audience
   - Phase 3: 50% audience
   - Phase 4: 100%
4. Monitoring:
   - Check `metrics_ai/{processingId}` timings
   - Track error logs (visual/enriched analysis validation failures)
   - Monitor Vertex AI budget alerts


---

## Guardrails

- **Kill switch:** Keep `is_vertex_enabled=false` in prod until launch
- **Token logging:** Use `ai_count_tokens_enabled=true` only in staging
- **Concurrency:** Enforced via RC `ai_max_concurrent_ops`; fails closed on errors
- **Region:** Default `asia-southeast1` supports Gemini 2.5 Flash

---

## Current Status (v1)

- Pipeline stages implemented: extraction, visual metrics, AI visual analysis, optional web enrichment, enriched analysis, summary generation, validation, and persistence.
- Remote Config kill switch: `is_vertex_enabled` defaults to `false` in production.
- Web enrichment caching: enabled via Firestore with TTL (`web_enrichment_cache_ttl_days`).
- Admin/staging utilities: `testFontPipeline`, `batchReprocessFonts` HTTP functions.
- Tests: Unit and integration tests available under `functions/tests/` (golden set at `tests/golden-set/fonts.json`).

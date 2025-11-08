# Deployment Guide for AI Font Processing Pipeline

## Quick Reference

**Two `.env.local` Files Required:**
1. **Root `.env.local`** → Next.js app (frontend + API routes)
2. **`functions/.env.local`** → Cloud Functions emulator

**Production Configuration:**
- **Vercel** → Set Next.js environment variables
- **Firebase Console** → Set Cloud Functions environment variables

**Key Points:**
- Cloud Functions don't inherit Vercel env vars (they run separately)
- Most variables have defaults (optional to set)
- Wrong variable names: `GOOGLE_CLOUD_PROJECT_ID`, `VERTEX_AI_REGION`, `FIREBASE_PROJECT_ID` (don't use these)

---

## Prerequisites

1. **Firebase CLI installed and authenticated**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Google Cloud Project configured**
   - Ensure your Firebase project has Vertex AI API enabled
   - Project ID will be automatically detected (no need to set `GOOGLE_CLOUD_PROJECT` manually in production)

3. **Node.js 22** (as specified in `package.json`)

4. **Service Account for Local Development** (optional, for emulator)
   - Create a service account JSON file for local testing
   - Set path in `.env.local` as `GOOGLE_APPLICATION_CREDENTIALS`

## Step 1: Install Dependencies

```bash
cd functions
npm install
```

**Note:** This project uses a simplified approach - no `node-canvas` dependency. Visual metrics are computed directly from font table data, which is faster and works reliably in Cloud Functions without native dependencies.

## Step 2: Configure Remote Config and Environment Variables

**Important:** You need **TWO separate `.env.local` files** because Next.js and Cloud Functions run as separate processes and don't share environment variables.

### Remote Config (server)

Publish these parameters (suggested defaults in backticks). These are read by Cloud Functions; no client access required.

- is_vertex_enabled: Boolean (`false` prod, `true` staging)
- web_enrichment_enabled: Boolean (`false`)
- ai_cache_enabled: Boolean (`true`)
- ai_count_tokens_enabled: Boolean (`false` prod, `true` staging)
- vertex_location_id: String (`asia-southeast1`)
- classifier_model_name: String (`gemini-2.5-flash`)
- summary_model_name: String (`gemini-2.5-flash`)
- visual_analysis_model_name: String (`gemini-2.5-flash`)
- enriched_analysis_model_name: String (`gemini-2.5-flash`)
- enriched_analysis_fallback_model_name: String (`gemini-2.5-flash`)
- web_enricher_model_name: String (`gemini-2.5-flash`)
- ai_max_output_tokens: Number (`1536`)
- ai_temperature: Number (`0.4`)
- ai_top_p: Number (`0.9`)
- ai_top_k: Number (`40`)
- ai_max_concurrent_ops: Number (`4`)
- ai_retry_max_attempts: Number (`3`)
- ai_retry_base_ms: Number (`250`)
- ai_retry_max_ms: Number (`4000`)
- unprocessed_bucket_path: String (`unprocessed_fonts`)
- processed_bucket_path: String (`processed_fonts`)
- failed_bucket_path: String (`failed_processing`)

### For Local Development

#### File 1: Root `.env.local` (Project Root)

**Location:** `/Users/adi/Projects/seriph/.env.local`

**Purpose:** Next.js app (frontend + API routes)

```bash
# ============================================
# FIREBASE CLIENT CONFIGURATION (Required)
# ============================================
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"

# ============================================
# FIREBASE ADMIN CONFIGURATION (Required)
# ============================================
FIREBASE_ADMIN_PROJECT_ID="your-project-id"
FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ============================================
# STORAGE CONFIGURATION (Optional)
# ============================================
FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"

# ============================================
# DEVELOPMENT TOOLS (Optional)
# ============================================
UPLOAD_SECRET_TOKEN="change-me"
NEXT_PUBLIC_ENABLE_REACT_GRAB=true
```

#### File 2: `functions/.env.local` (Functions Directory)

**Location:** `/Users/adi/Projects/seriph/functions/.env.local`

**Purpose:** Cloud Functions emulator

```bash
# ============================================
# GOOGLE CLOUD CREDENTIALS (Required for Local)
# ============================================
# Absolute path to service account JSON file
GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/your-service-account.json"

# ============================================
# VERTEX AI CONFIGURATION (Optional - Have Defaults)
# ============================================
# CRITICAL: DO NOT include GOOGLE_CLOUD_PROJECT here!
# Firebase automatically sets GOOGLE_CLOUD_PROJECT during deployment
# Including it will cause: "Error Key GOOGLE_CLOUD_PROJECT is reserved for internal use"
# The code uses process.env.GOOGLE_CLOUD_PROJECT || 'seriph' as fallback
GOOGLE_CLOUD_LOCATION="us-central1"

# ============================================
# AI PIPELINE CONFIGURATION (Optional - Have Defaults)
# ============================================
GEMINI_WEB_SEARCH_ENABLED="true"
GEMINI_FALLBACK_MODEL="gemini-2.5-pro"
MAX_CONCURRENT_AI_OPS="5"
```

**Note:** Both `.env.local` files are gitignored and only used for local development. They are NOT deployed to production.

### For Production Deployment

**Critical:** Next.js and Cloud Functions run separately and don't share environment variables. Configure them separately.

#### Next.js App (Vercel or your hosting platform)

Set these in **Vercel Dashboard → Project Settings → Environment Variables** (or your hosting platform):

```bash
# Required - Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID  # Optional

# Required - Firebase Admin (Server-Side)
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY

# Optional
FIREBASE_STORAGE_BUCKET
UPLOAD_SECRET_TOKEN
NEXT_PUBLIC_ENABLE_REACT_GRAB
```

#### Cloud Functions (Firebase Console)

Set these in **Firebase Console → Functions → Configuration → Environment Variables**:

```bash
# CRITICAL: DO NOT set GOOGLE_CLOUD_PROJECT here!
# Firebase automatically sets GOOGLE_CLOUD_PROJECT based on the project being deployed to
# Setting it manually will cause: "Error Key GOOGLE_CLOUD_PROJECT is reserved for internal use"

# Optional (have defaults, but recommended to set explicitly)
GOOGLE_CLOUD_LOCATION="us-central1"     # Defaults to 'us-central1'
GEMINI_WEB_SEARCH_ENABLED="true"        # Defaults to false
GEMINI_FALLBACK_MODEL="gemini-2.5-pro"  # Has default
MAX_CONCURRENT_AI_OPS="5"               # Defaults to 5
```

**Important:** Cloud Functions automatically get `GOOGLE_CLOUD_PROJECT` from the Firebase project. **Do NOT set it manually** - it will cause deployment errors.

**Setting via Firebase Console (Recommended):**
1. Go to Firebase Console → Functions → Configuration → Environment Variables
2. Add/edit variables:
   - `GOOGLE_CLOUD_LOCATION` = `us-central1`
   - `GEMINI_WEB_SEARCH_ENABLED` = `true`
   - `MAX_CONCURRENT_AI_OPS` = `5`
3. Redeploy: `firebase deploy --only functions`

**Setting via gcloud CLI (2nd Gen Functions):**
```bash
# Set environment variables during deployment
gcloud functions deploy processUploadedFontStorage \
  --gen2 \
  --region=us-central1 \
  --set-env-vars GOOGLE_CLOUD_LOCATION=us-central1,GEMINI_WEB_SEARCH_ENABLED=true,MAX_CONCURRENT_AI_OPS=5 \
  --project=your-project-id
```

**Note:** The deprecated `firebase functions:config:set` API is being shut down in March 2026. This codebase uses `process.env` directly, so use Firebase Console or gcloud CLI to set environment variables.

**Variables NOT Used (Do Not Set):**
- ❌ `GOOGLE_APPLICATION_CREDENTIALS` — **Do NOT set in production** (local emulator only)
- ❌ `GEMINI_WEB_SEARCH_ENABLED` — Use RC `web_enrichment_enabled`
- ❌ `MAX_CONCURRENT_AI_OPS` — Use RC `ai_max_concurrent_ops`
- ❌ `VERTEX_MODEL_NAME` — Use per‑stage RC model names
- ❌ `GOOGLE_CLOUD_LOCATION` — Use RC `vertex_location_id`
- ❌ `GOOGLE_CLOUD_PROJECT_ID` — Wrong name; `GOOGLE_CLOUD_PROJECT` is set automatically
- ❌ `FIREBASE_PROJECT_ID` — Not used (web uses `NEXT_PUBLIC_FIREBASE_PROJECT_ID`)

## Step 3: Configure IAM Permissions

Your Cloud Functions service account needs both **Vertex AI** and **Cloud Storage** permissions.

### Get Your Service Account

For 2nd Gen Cloud Functions (Cloud Run), the service account is:
- **Default:** `PROJECT_NUMBER-compute@developer.gserviceaccount.com` (Compute Engine default service account)
- **Or:** `PROJECT_ID@appspot.gserviceaccount.com` (App Engine default service account)

Find your project number:
```bash
PROJECT_ID=your-project-id
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
echo "Service account: ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

### Grant Vertex AI Permissions

```bash
PROJECT_ID=your-project-id
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user"
```

### Grant Cloud Storage Permissions

**CRITICAL:** The service account needs Storage permissions to:
- Read from `unprocessed_fonts/` directory
- Write to `processed_fonts/` directory  
- Move files to `failed_processing/` directory
- Delete files from `unprocessed_fonts/` directory

**Option 1: Grant Storage Object Admin (Recommended - Full Access)**
```bash
PROJECT_ID=your-project-id
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}.appspot.com"  # Default Firebase Storage bucket

# Grant Storage Object Admin on the bucket
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin gs://${BUCKET_NAME}
```

**Option 2: Grant Minimum Required Permissions**
```bash
PROJECT_ID=your-project-id
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}.appspot.com"

# Grant Storage Object Viewer (read)
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectViewer gs://${BUCKET_NAME}

# Grant Storage Object Creator (write)
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectCreator gs://${BUCKET_NAME}
```

**Option 3: Via Google Cloud Console**
1. Go to **Cloud Storage → Buckets**
2. Click on your Firebase Storage bucket (usually `PROJECT_ID.appspot.com`)
3. Go to **Permissions** tab
4. Click **Grant Access**
5. Add service account: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
6. Select role: **Storage Object Admin** (or **Storage Object Viewer** + **Storage Object Creator**)
7. Save

**Verify Permissions:**
```bash
# Check current IAM bindings on the bucket
gsutil iam get gs://${BUCKET_NAME}
```

## Step 4: Enable Required APIs

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  cloudfunctions.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com
```

## Step 5: Build TypeScript

```bash
cd functions
npm run build
```

This compiles TypeScript from `src/` to `lib/`.

## Step 6: Test Locally (Optional)

```bash
# Start emulators
cd ..
firebase emulators:start

# Or just functions emulator
cd functions
npm run serve
```

Upload a test font to `unprocessed_fonts/` in the emulator storage.

### Emulator E2E benchmarking

Run the emulators (functions, firestore, storage) and upload a sample font into the unprocessed path. The function writes per‑stage timings to Firestore `metrics_ai/{processingId}` and logs token usage when enabled.

1) Start emulators:
```bash
firebase emulators:start --project <PROJECT_ID> --only functions,firestore,storage
```
2) In another shell, upload a sample:
```bash
./scripts/run-emulator-benchmark.sh <PROJECT_ID>
```
3) Check Function logs and Firestore `metrics_ai` document for the processingId printed by the script.

Guardrails:
- Keep `is_vertex_enabled=false` in prod until launch.
- Use `ai_count_tokens_enabled=true` only in staging.
- Concurrency is enforced via RC `ai_max_concurrent_ops`; fail‑closed on semaphore errors.

## Step 7: Deploy Functions

### Deploy all functions:
```bash
cd ..
firebase deploy --only functions
```

### Deploy specific function:
```bash
firebase deploy --only functions:processUploadedFontStorage
```

### Deploy with specific project:
```bash
firebase deploy --only functions --project your-project-id
```

## Step 8: Verify Deployment

1. **Check function logs:**
   ```bash
   firebase functions:log
   ```

2. **Test upload:**
   - Upload a font file via your app
   - Check logs for pipeline execution
   - Verify Firestore document creation

3. **Monitor rate limiting:**
   ```bash
   # Check rate limit document
   firebase firestore:get _rateLimits/global
   ```

## Step 9: Firestore Indexes (if needed)

If you query by provenance or other new fields, create indexes:

```bash
# Deploy indexes
firebase deploy --only firestore:indexes
```

Or add to `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "fontfamilies",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "metadata.provenance", "order": "ASCENDING" }
      ]
    }
  ]
}
```

## Troubleshooting

### Build Errors
```bash
# Clean and rebuild
cd functions
rm -rf lib node_modules
npm install
npm run build
```

### Deployment Errors

1. **"Error Key GOOGLE_CLOUD_PROJECT is reserved for internal use":**
   - **Cause:** `GOOGLE_CLOUD_PROJECT` is set in `.env.<project-id>` file or via Firebase Console
   - **Fix:** Remove `GOOGLE_CLOUD_PROJECT` from:
     - `functions/.env.local`
     - `functions/.env.<project-id>` (e.g., `functions/.env.seriph`)
     - Firebase Console → Functions → Configuration → Environment Variables
   - **Why:** Firebase automatically sets `GOOGLE_CLOUD_PROJECT` based on the project being deployed to
   - **Note:** The code uses `process.env.GOOGLE_CLOUD_PROJECT || 'seriph'` as a fallback, so it will work without explicit setting

2. **Deprecation warning about `functions.config()` API:**
   - **Cause:** Firebase CLI warning about deprecated Runtime Configuration API (shutting down March 2026)
   - **Status:** ✅ **This codebase is already migrated!** It uses `process.env` directly, not `functions.config()`
   - **Action:** No code changes needed. The warning appears because old `functions:config:set` commands may be referenced in docs, but the actual code uses environment variables correctly
   - **Future-proof:** Continue using Firebase Console or gcloud CLI to set environment variables (not `firebase functions:config:set`)

### Runtime Errors

1. **"The file at /absolute/path/to/seriph-dev-sa.json does not exist":**
   - **Cause:** `GOOGLE_APPLICATION_CREDENTIALS` is set in production environment variables
   - **Fix:** Remove `GOOGLE_APPLICATION_CREDENTIALS` from Firebase Console → Functions → Configuration → Environment Variables
   - **Why:** Cloud Functions automatically use the default service account in production. `GOOGLE_APPLICATION_CREDENTIALS` is ONLY for local development
   - **How to remove:** Firebase Console → Functions → Configuration → Environment Variables → Delete `GOOGLE_APPLICATION_CREDENTIALS`

2. **"Permission denied" for Vertex AI:**
   - Verify IAM role `roles/aiplatform.user` is assigned
   - Check service account has correct permissions
   - Service account format: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`

3. **"Permission denied" for Cloud Storage (storage.objects.get):**
   - **Cause:** Cloud Run service account lacks Storage permissions
   - **Quick Fix:** Run the provided script:
     ```bash
     ./scripts/fix-storage-permissions.sh [project-id]
     ```
   - **Manual Fix:** Grant Storage Object Admin role to the service account:
     ```bash
     PROJECT_ID=your-project-id
     PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
     SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
     BUCKET_NAME="${PROJECT_ID}.appspot.com"
     
     gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin gs://${BUCKET_NAME}
     ```
   - **Verify:** Check service account has access:
     ```bash
     gsutil iam get gs://${BUCKET_NAME} | grep ${SERVICE_ACCOUNT}
     ```
   - **Common Issue:** Using wrong service account. For 2nd Gen Functions (Cloud Run), use `PROJECT_NUMBER-compute@developer.gserviceaccount.com`, not `PROJECT_ID@appspot.gserviceaccount.com`

4. **"Model not found":**
   - Verify per‑stage RC model names are valid (e.g., `gemini-2.5-flash`)
   - Check Vertex AI API is enabled
   - Verify RC region (`asia-southeast1`) supports the model
   - If needed, temporarily switch `vertex_location_id` via RC to a supported region

5. **Rate limiting issues:**
   - Check `_rateLimits/global` document exists
   - Verify `MAX_CONCURRENT_AI_OPS` is set correctly
   - Check function logs for rate limit messages

6. **Web search not working:**
   - Verify `GEMINI_WEB_SEARCH_ENABLED=true` is set
   - Check Gemini model supports web search (2.5 Flash should)
   - Review enriched analysis logs
   - Note: Web search is optional and only runs if enabled

### View Function Configuration

For 2nd Gen Functions, view environment variables in Firebase Console:
- Firebase Console → Functions → Configuration → Environment Variables

Or via gcloud CLI:
```bash
gcloud functions describe processUploadedFontStorage \
  --gen2 --region=us-central1 --project=your-project-id
```

### Update Remote Config

**Via Firebase Console (Recommended):**
1. Go to Firebase Console → Remote Config
2. Edit parameters (model names, region, flags, concurrency)
3. Publish changes (no redeploy required for RC-only changes)

**Note:** The deprecated `firebase functions:config:set` commands will stop working after March 2026. Use Firebase Console or gcloud CLI instead.

## Production Checklist

### Environment Setup
- [ ] Root `.env.local` created for Next.js app (local dev only)
- [ ] `functions/.env.local` created for Cloud Functions emulator (local dev only)
- [ ] Both `.env.local` files are gitignored (already in `.gitignore`)
- [ ] Vercel environment variables set (for Next.js app)
- [ ] Firebase Console environment variables set (for Cloud Functions)
- [ ] **CRITICAL:** `GOOGLE_APPLICATION_CREDENTIALS` is NOT set in production (only for local dev)
- [ ] Removed wrong variable names (`GOOGLE_CLOUD_PROJECT_ID`, `VERTEX_AI_REGION`, `FIREBASE_PROJECT_ID`)

### Deployment
- [ ] Dependencies installed (`npm install` in functions/)
- [ ] TypeScript compiles without errors (`npm run build` in functions/)
- [ ] IAM permissions set (Vertex AI User role)
- [ ] APIs enabled (Vertex AI, Cloud Functions, Firestore, Storage)
- [ ] Functions deployed successfully
- [ ] Test upload works end-to-end
- [ ] Logs show pipeline execution
- [ ] Rate limiting document created (`_rateLimits/global`)
- [ ] Firestore indexes created (if needed)
- [ ] Monitoring/alerts configured (optional)

## Monitoring

### View Real-time Logs
```bash
firebase functions:log --only processUploadedFontStorage
```

### Check Function Status
```bash
firebase functions:list
```

### Monitor Costs
- Google Cloud Console → Billing
- Set up budget alerts for Vertex AI usage
- Monitor Cloud Functions invocations

## Rollback

If deployment fails:
```bash
# Deploy previous version
firebase functions:rollback

# Or deploy specific version
firebase deploy --only functions --project your-project-id
```

## Next Steps

1. **Set up monitoring/alerts** for:
   - Function execution time
   - Vertex AI API costs
   - Error rates
   - Rate limit hits

2. **Optimize costs:**
   - Adjust `MAX_CONCURRENT_AI_OPS` based on usage (default: 5)
   - Monitor token usage via Google Cloud Console
   - Consider caching duplicate font families (not yet implemented)
   - Review web search usage (`GEMINI_WEB_SEARCH_ENABLED`) - disable if not needed

3. **Scale considerations:**
   - Cloud Functions auto-scales, but monitor:
     - Concurrent executions
     - Memory usage (currently 1GiB)
     - Timeout (currently 540s)


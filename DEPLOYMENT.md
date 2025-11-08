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

## Step 2: Configure Environment Variables

**Important:** You need **TWO separate `.env.local` files** because Next.js and Cloud Functions run as separate processes and don't share environment variables.

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

**Setting via Firebase CLI:**

```bash
# Option 1: During deployment (2nd Gen Functions)
firebase deploy --only functions \
  --set-env-vars GOOGLE_CLOUD_LOCATION=us-central1,GEMINI_WEB_SEARCH_ENABLED=true,MAX_CONCURRENT_AI_OPS=5

# Option 2: Legacy config method (still works)
firebase functions:config:set \
  google.cloud.location="us-central1" \
  gemini.web_search.enabled="true" \
  max.concurrent.ai_ops="5" \
  gemini.fallback_model="gemini-2.5-pro"
```

**Variables NOT Used (Do Not Set):**
- ❌ `AI_CACHE_ENABLED` - No caching logic exists in code
- ❌ `VERTEX_AI_MAX_RETRIES` - No retry logic uses this variable
- ❌ `IS_VERTEX_ENABLED` - Vertex AI is always enabled (hardcoded)
- ❌ `VERTEX_MODEL_NAME` - Model name is hardcoded in code (`gemini-2.5-flash`)
- ❌ `VERTEX_LOCATION` - Use `GOOGLE_CLOUD_LOCATION` instead
- ❌ `GOOGLE_CLOUD_PROJECT_ID` - Wrong name, and `GOOGLE_CLOUD_PROJECT` is automatically set by Firebase (don't set manually)
- ❌ `FIREBASE_PROJECT_ID` - Not used (you have `NEXT_PUBLIC_FIREBASE_PROJECT_ID`)

## Step 3: Configure IAM Permissions

Your Cloud Functions service account needs Vertex AI access:

```bash
# Get your service account email
PROJECT_ID=your-project-id
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user"
```

Or via Google Cloud Console:
1. Go to IAM & Admin → IAM
2. Find your App Engine default service account (`PROJECT_ID@appspot.gserviceaccount.com`)
3. Add role: **Vertex AI User** (`roles/aiplatform.user`)

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

### Runtime Errors

1. **"Permission denied" for Vertex AI:**
   - Verify IAM role `roles/aiplatform.user` is assigned
   - Check service account has correct permissions

2. **"Model not found":**
   - Verify model name: `gemini-2.5-flash` (hardcoded in code)
   - Check Vertex AI API is enabled
   - Verify region (`us-central1`) supports the model
   - Note: Model name cannot be changed via env variable (hardcoded)

3. **Rate limiting issues:**
   - Check `_rateLimits/global` document exists
   - Verify `MAX_CONCURRENT_AI_OPS` is set correctly
   - Check function logs for rate limit messages

4. **Web search not working:**
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

### Update Environment Variables

**Via Firebase Console (Recommended):**
1. Go to Firebase Console → Functions → Configuration
2. Edit environment variables
3. Redeploy: `firebase deploy --only functions`

**Via Firebase CLI:**
```bash
# Set new value
firebase functions:config:set max.concurrent.ai_ops="10"

# Redeploy to apply
firebase deploy --only functions
```

**Via gcloud CLI (2nd Gen Functions):**
```bash
gcloud functions deploy processUploadedFontStorage \
  --gen2 \
  --region=us-central1 \
  --set-env-vars MAX_CONCURRENT_AI_OPS=10
```

## Production Checklist

### Environment Setup
- [ ] Root `.env.local` created for Next.js app (local dev only)
- [ ] `functions/.env.local` created for Cloud Functions emulator (local dev only)
- [ ] Both `.env.local` files are gitignored (already in `.gitignore`)
- [ ] Vercel environment variables set (for Next.js app)
- [ ] Firebase Console environment variables set (for Cloud Functions)
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


# Deployment Guide for AI Font Processing Pipeline

## Prerequisites

1. **Firebase CLI installed and authenticated**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Google Cloud Project configured**
   - Ensure your Firebase project has Vertex AI API enabled
   - Project ID should match `GOOGLE_CLOUD_PROJECT` environment variable

3. **Node.js 22** (as specified in `package.json`)

## Step 1: Install Dependencies

```bash
cd functions
npm install
```

## Step 2: Set Environment Variables

Set these environment variables for your Cloud Functions. You can do this via:

### Option A: Firebase Console (Recommended)
1. Go to Firebase Console → Functions → Configuration
2. Add the following environment variables:

```bash
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GEMINI_WEB_SEARCH_ENABLED=true
AI_CACHE_ENABLED=true
MAX_CONCURRENT_AI_OPS=5
GEMINI_FALLBACK_MODEL=gemini-2.0-flash-exp
VERTEX_AI_MAX_RETRIES=3
```

### Option B: Firebase CLI
```bash
firebase functions:config:set \
  google.cloud.project="your-project-id" \
  google.cloud.location="us-central1" \
  gemini.web_search.enabled="true" \
  ai.cache.enabled="true" \
  max.concurrent.ai_ops="5" \
  gemini.fallback_model="gemini-2.0-flash-exp" \
  vertex.ai.max_retries="3"
```

### Option C: .env file (for local development)
Create `functions/.env`:
```
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GEMINI_WEB_SEARCH_ENABLED=true
AI_CACHE_ENABLED=true
MAX_CONCURRENT_AI_OPS=5
GEMINI_FALLBACK_MODEL=gemini-2.0-flash-exp
VERTEX_AI_MAX_RETRIES=3
```

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

### Runtime Errors

1. **"Permission denied" for Vertex AI:**
   - Verify IAM role `roles/aiplatform.user` is assigned
   - Check service account has correct permissions

2. **"Model not found":**
   - Verify model name: `gemini-2.5-flash-preview-05-20`
   - Check Vertex AI API is enabled
   - Verify region (`us-central1`) supports the model

3. **Rate limiting issues:**
   - Check `_rateLimits/global` document exists
   - Verify `MAX_CONCURRENT_AI_OPS` is set correctly
   - Check function logs for rate limit messages

4. **Web search not working:**
   - Verify `GEMINI_WEB_SEARCH_ENABLED=true`
   - Check Gemini model supports web search (2.5 Flash should)
   - Review enriched analysis logs

### View Function Configuration
```bash
firebase functions:config:get
```

### Update Environment Variables
```bash
# Set new value
firebase functions:config:set max.concurrent.ai_ops="10"

# Redeploy to apply
firebase deploy --only functions
```

## Production Checklist

- [ ] Environment variables configured
- [ ] IAM permissions set (Vertex AI User role)
- [ ] APIs enabled (Vertex AI, Cloud Functions, Firestore, Storage)
- [ ] TypeScript compiles without errors
- [ ] Functions deployed successfully
- [ ] Test upload works end-to-end
- [ ] Logs show pipeline execution
- [ ] Rate limiting document created
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
   - Adjust `MAX_CONCURRENT_AI_OPS` based on usage
   - Enable caching for duplicate font families
   - Monitor token usage

3. **Scale considerations:**
   - Cloud Functions auto-scales, but monitor:
     - Concurrent executions
     - Memory usage (currently 1GiB)
     - Timeout (currently 540s)


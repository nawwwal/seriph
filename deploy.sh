#!/bin/bash

# Quick deployment script for AI Font Processing Pipeline
# Usage: ./deploy.sh [project-id]

set -e

PROJECT_ID=${1:-$(firebase use | grep -oP '(?<=\()[^)]+')}

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Project ID not found. Please specify: ./deploy.sh your-project-id"
    exit 1
fi

echo "🚀 Deploying to project: $PROJECT_ID"

# Step 1: Build TypeScript
echo "📦 Building TypeScript..."
cd functions
npm install
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"

# Step 2: Check environment variables
echo "🔍 Checking environment variables..."
cd ..

# Note: Environment variables should be set via Firebase Console or CLI
echo "⚠️  Make sure these environment variables are set:"
echo "   - GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
echo "   - GOOGLE_CLOUD_LOCATION=us-central1"
echo "   - GEMINI_WEB_SEARCH_ENABLED=true"
echo "   - MAX_CONCURRENT_AI_OPS=5"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 3: Deploy functions
echo "🚀 Deploying Cloud Functions..."
firebase deploy --only functions --project "$PROJECT_ID"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📊 Next steps:"
    echo "   1. Check logs: firebase functions:log"
    echo "   2. Test upload a font file"
    echo "   3. Verify Firestore document creation"
    echo ""
    echo "🔍 Monitor rate limiting:"
    echo "   firebase firestore:get _rateLimits/global"
else
    echo "❌ Deployment failed!"
    exit 1
fi


// scripts/reset.js
// Destructive: deletes all docs in fontfamilies and all files in the storage bucket
// Usage: node scripts/reset.js

require('dotenv').config({ path: '.env.local' });

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

// Prefer explicit admin bucket; fall back to projectId.appspot.com; finally to NEXT_PUBLIC bucket
const fallbackBucket = projectId ? `${projectId}.appspot.com` : undefined;
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!bucketName) {
  console.error('No storage bucket could be resolved. Set FIREBASE_STORAGE_BUCKET in .env.local.');
  process.exit(1);
}

initializeApp({
  credential: (projectId && clientEmail && rawPrivateKey)
    ? cert({ projectId, clientEmail, privateKey: rawPrivateKey.replace(/\\n/g, '\n') })
    : applicationDefault(),
  storageBucket: bucketName,
});

const db = getFirestore();
const bucket = getStorage().bucket();

async function deleteCollection(coll, batchSize = 500) {
  const ref = db.collection(coll);
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

(async function main() {
  console.log('Deleting Firestore collection: fontfamilies');
  await deleteCollection('fontfamilies');

  console.log('Deleting ALL files from Storage bucket:', bucket.name);
  await bucket.deleteFiles({ prefix: '' });

  console.log('Reset complete.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});



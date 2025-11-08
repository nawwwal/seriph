#!/usr/bin/env ts-node
/**
 * Migrate legacy `classification` string field to `metadata.semantics.style_primary.value`.
 * Run with GOOGLE_APPLICATION_CREDENTIALS set (admin credentials).
 */
import * as admin from 'firebase-admin';

const STYLE_MAP: Record<string, string> = {
  serif: 'serif',
  'sans serif': 'sans',
  sans: 'sans',
  slab: 'slab',
  monospace: 'mono',
  mono: 'mono',
  display: 'display',
  script: 'script',
  blackletter: 'blackletter',
  icon: 'icon',
};

function mapClassification(input?: string | null): string | null {
  if (!input) return null;
  const key = String(input).trim().toLowerCase();
  return STYLE_MAP[key] || null;
}

async function main() {
  admin.initializeApp();
  const db = admin.firestore();
  const globalFamilies = db.collection('fontfamilies');
  const snapshot = await globalFamilies.get();
  let migrated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    const legacy = data?.classification as string | undefined;
    const mapped = mapClassification(legacy);
    if (!mapped) continue;
    const semanticsPath = 'metadata.semantics.style_primary.value';
    await doc.ref.set(
      {
        metadata: {
          semantics: {
            style_primary: { value: mapped, confidence: 0.6 },
          },
        },
      },
      { merge: true }
    );
    migrated++;
  }
  console.log(`Migrated ${migrated} family documents in global collection.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



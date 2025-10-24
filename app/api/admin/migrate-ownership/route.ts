import { NextRequest, NextResponse } from 'next/server';
// Lazy import admin only after auth check passes to avoid initializing admin on 401s

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const adminHeader = request.headers.get('x-admin-token') || '';
    const required = process.env.ADMIN_MIGRATION_TOKEN || '';
    if (!required || adminHeader !== required) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUid = body?.targetUid as string | undefined;
    if (!targetUid) {
      return NextResponse.json({ error: 'targetUid required' }, { status: 400 });
    }

    // Import admin only after token validation
    const { adminDb } = await import('@/lib/firebase/admin');

    const batchSize = 300;
    let updated = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (true) {
      let query = adminDb.collection('fontfamilies')
        .where('ownerId', '==', null)
        .orderBy('name')
        .limit(batchSize);
      if (lastDoc) query = query.startAfter(lastDoc);

      let snap: FirebaseFirestore.QuerySnapshot;
      try {
        snap = await query.get();
      } catch (err: any) {
        const msg = typeof err?.message === 'string' ? err.message : '';
        const isIndexMissing = (err?.code === 9 /* failed-precondition */ || err?.code === 'failed-precondition') && msg.includes('requires an index');
        if (!isIndexMissing) throw err;
        // Fallback: drop orderBy and page by __name__ instead
        let fallbackQuery = adminDb.collection('fontfamilies')
          .where('ownerId', '==', null)
          .orderBy(adminDb.collection('fontfamilies').doc().id) as any; // placeholder to satisfy TS type
        // Simpler: no order, limit by batch, then sort in memory
        fallbackQuery = adminDb.collection('fontfamilies')
          .where('ownerId', '==', null)
          .limit(batchSize);
        snap = await fallbackQuery.get();
        // Sort in-memory by name to keep behavior stable
        const sortedDocs = snap.docs.slice().sort((a, b) => {
          const an = (a.get('name') || '') as string;
          const bn = (b.get('name') || '') as string;
          return an.localeCompare(bn);
        });
        // Replace snap.docs iteration using sortedDocs below
        const batch = adminDb.batch();
        sortedDocs.forEach((doc) => {
          batch.set(doc.ref, { ownerId: targetUid }, { merge: true });
        });
        await batch.commit();
        updated += sortedDocs.length;
        if (sortedDocs.length < batchSize) break;
        continue;
      }

      if (snap.empty) break;
      const batch = adminDb.batch();
      snap.docs.forEach((doc) => {
        batch.set(doc.ref, { ownerId: targetUid }, { merge: true });
      });
      await batch.commit();
      updated += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < batchSize) break;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (error: any) {
    console.error('migrate-ownership error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


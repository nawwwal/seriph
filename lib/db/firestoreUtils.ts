import { db } from '@/lib/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { FontFamily } from '@/models/font.models';
import { adaptFamilyDoc } from './catalogAdapter';

const FAMILIES_COLLECTION = 'fontfamilies';

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof (value as any)?.toDate === 'function') return (value as any).toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export async function getAllFontFamilies(ownerId?: string): Promise<{
  families: FontFamily[];
  errorCode?: string;
  errorMessage?: string;
}> {
  try {
    const col = collection(db, FAMILIES_COLLECTION);
    const qy = ownerId ? query(col, where('ownerId', '==', ownerId)) : query(col);
    const snap = await getDocs(qy);
    const families = snap.docs
      .map((d) => adaptFamilyDoc(d.data(), d.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { families };
  } catch (error: any) {
    if (error?.code !== 'permission-denied') console.error('Error fetching font families:', error);
    return { families: [], errorCode: error?.code, errorMessage: error?.message ?? 'Unknown error' };
  }
}

export async function getFontFamilyById(familyId: string): Promise<FontFamily | null> {
  if (!familyId) return null;
  try {
    const snap = await getDoc(doc(db, FAMILIES_COLLECTION, familyId));
    if (!snap.exists()) return null;
    return adaptFamilyDoc(snap.data(), familyId);
  } catch (error) {
    console.error(`Error fetching family "${familyId}":`, error);
    return null;
  }
}

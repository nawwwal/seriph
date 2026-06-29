import { db } from '@/lib/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { FontFamily } from '@/models/font.models';
import { adaptFamilyDoc, isCatalogAliasDoc, mergedInto } from './catalogAdapter';

const FAMILIES_COLLECTION = 'fontfamilies';

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  if (typeof value === 'string') return value;
  return null;
}

function errorInfo(error: unknown): { code?: string; message: string } {
  if (error instanceof Error) return { message: error.message };
  if (error && typeof error === 'object') {
    const value = error as { code?: unknown; message?: unknown };
    return {
      code: typeof value.code === 'string' ? value.code : undefined,
      message: typeof value.message === 'string' ? value.message : 'Unknown error',
    };
  }
  return { message: 'Unknown error' };
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
      .filter((d) => !isCatalogAliasDoc(d.data()))
      .map((d) => adaptFamilyDoc(d.data(), d.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { families };
  } catch (error) {
    const info = errorInfo(error);
    if (info.code !== 'permission-denied') console.error('Error fetching font families:', error);
    return { families: [], errorCode: info.code, errorMessage: info.message };
  }
}

export async function getFontFamilyById(familyId: string): Promise<FontFamily | null> {
  if (!familyId) return null;
  try {
    const snap = await getDoc(doc(db, FAMILIES_COLLECTION, familyId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const targetId = mergedInto(data);
    if (targetId) {
      const target = await getDoc(doc(db, FAMILIES_COLLECTION, targetId));
      return target.exists() && !isCatalogAliasDoc(target.data()) ? adaptFamilyDoc(target.data(), target.id) : null;
    }
    return isCatalogAliasDoc(data) ? null : adaptFamilyDoc(data, familyId);
  } catch (error) {
    console.error(`Error fetching family "${familyId}":`, error);
    return null;
  }
}

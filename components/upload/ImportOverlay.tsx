'use client';

import dynamic from 'next/dynamic';
import { useUploads } from '@/lib/contexts/UploadContext';
import UploadSurface from './UploadSurface';

const ImportOptionsModal = dynamic(() => import('@/components/import/ImportOptionsModal'), {
  ssr: false,
});

export default function ImportOverlay() {
  const { isImportOpen } = useUploads();
  return <><UploadSurface />{isImportOpen ? <ImportOptionsModal /> : null}</>;
}

'use client';

import dynamic from 'next/dynamic';
import UploadSurface from './UploadSurface';

const ImportOptionsModal = dynamic(() => import('@/components/import/ImportOptionsModal'), {
  ssr: false,
});

export default function ImportOverlay() {
  return <><UploadSurface /><ImportOptionsModal /></>;
}

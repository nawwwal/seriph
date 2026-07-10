'use client';

import dynamic from 'next/dynamic';
import { useUploads } from '@/lib/contexts/UploadContext';

const UploadCenterModal = dynamic(() => import('./UploadCenterModal'), {
  ssr: false,
});

export default function UploadCenterOverlay() {
  const { isOpen } = useUploads();
  return isOpen ? <UploadCenterModal /> : null;
}

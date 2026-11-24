'use client';

import dynamic from 'next/dynamic';

const InterfaceKit = dynamic(() => import('interface-kit/react').then((mod) => mod.InterfaceKit), { ssr: false });
const Agentation = dynamic(() => import('agentation').then((mod) => mod.Agentation), { ssr: false });

export default function DevOverlays() {
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <>
      <InterfaceKit />
      <Agentation />
    </>
  );
}

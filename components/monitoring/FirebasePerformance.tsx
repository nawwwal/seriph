'use client';

import { useEffect } from 'react';
import { initializePerformanceMonitoring } from '@/lib/firebase/performance';

export default function FirebasePerformance() {
  useEffect(() => {
    void initializePerformanceMonitoring();
  }, []);

  return null;
}

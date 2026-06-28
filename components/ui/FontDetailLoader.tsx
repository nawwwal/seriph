'use client';

import { SkeletonNav, SkeletonHeader, SkeletonSpecimen } from './skeletonHero';
import { SkeletonStyles, SkeletonTester, SkeletonFooter } from './skeletonBody';

/** Full-page loading skeleton for the font detail route. */
export default function FontDetailLoader() {
  return (
    <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
      <SkeletonNav />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <SkeletonHeader />
        <SkeletonSpecimen />
        <SkeletonStyles />
        <SkeletonTester />
        <SkeletonFooter />
      </div>
    </div>
  );
}

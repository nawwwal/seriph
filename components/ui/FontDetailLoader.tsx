'use client';

import { SkeletonHeader, SkeletonSpecimen } from './skeletonHero';
import { SkeletonStyles, SkeletonTester, SkeletonFooter } from './skeletonBody';

/** Body loading skeleton for the font detail route. */
export default function FontDetailLoader() {
  return (
    <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
      <SkeletonHeader />
      <SkeletonSpecimen />
      <SkeletonTester />
      <SkeletonStyles />
      <SkeletonFooter />
    </div>
  );
}

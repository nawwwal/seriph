'use client';

import { SkeletonHeader, SkeletonSpecimen } from './skeletonHero';
import { SkeletonStyles, SkeletonTester, SkeletonFooter } from './skeletonBody';

/** Body loading skeleton for the font detail route. */
export default function FontDetailLoader() {
  return (
    <div className="h-full min-h-0 w-full overflow-auto p-5 sm:p-6 md:p-8 lg:p-10">
      <SkeletonHeader />
      <SkeletonSpecimen />
      <SkeletonTester />
      <SkeletonStyles />
      <SkeletonFooter />
    </div>
  );
}

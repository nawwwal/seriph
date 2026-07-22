import { describe, expect, it } from 'vitest';
import {
  isCatalogPath,
  isFamilyPath,
  workspaceNavDirection,
} from '@/lib/motion/workspaceNavDirection';

describe('workspaceNavDirection', () => {
  it('detects catalogue ↔ family as forward/back', () => {
    expect(workspaceNavDirection('/', '/family/abc')).toBe('forward');
    expect(workspaceNavDirection('/family/abc', '/')).toBe('back');
  });

  it('treats other hops as cross', () => {
    expect(workspaceNavDirection('/', '/search')).toBe('cross');
    expect(workspaceNavDirection('/family/a', '/search')).toBe('cross');
    expect(workspaceNavDirection('/family/a', '/family/b')).toBe('cross');
  });

  it('path helpers', () => {
    expect(isCatalogPath('/')).toBe(true);
    expect(isFamilyPath('/family/x')).toBe(true);
    expect(isFamilyPath('/family')).toBe(true);
  });
});

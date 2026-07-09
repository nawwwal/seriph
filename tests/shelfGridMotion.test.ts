import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shelfGridSource = fs.readFileSync(
  path.join(process.cwd(), 'components/home/ShelfFamilyGrid.tsx'),
  'utf8'
);

describe('shelf grid motion', () => {
  it('does not assign entry or layout motion to a populated first snapshot', () => {
    expect(shelfGridSource).toContain('const [previousFamilyTokens, setPreviousFamilyTokens] = useState<FamilyMotionTokens>(');
    expect(shelfGridSource).toContain('initial={shouldAnimateCard ? CARD_ENTER : false}');
    expect(shelfGridSource).not.toContain('\n          layout\n');
    expect(shelfGridSource).not.toContain('\n          layoutId=');
  });

  it('only transitions appended or changed cards after the first snapshot', () => {
    expect(shelfGridSource).toContain('const shouldAnimateCard = animatedFamilyIds.has(family.id);');
    expect(shelfGridSource).toContain('previousFamilyTokens.get(familyId) !== token');
  });

  it('keeps appended and changed cards static when reduced motion is enabled', () => {
    expect(shelfGridSource).toContain('const nextAnimatedFamilyIds = shouldReduceMotion');
    expect(shelfGridSource).toContain('animate={shouldAnimateCard ? CARD_VISIBLE : undefined}');
  });
});

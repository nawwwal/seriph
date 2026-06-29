import { describe, expect, it } from 'vitest';
import { readOS2 } from '../../src/parser/tables';

describe('readOS2', () => {
  it('reads fontkit OS/2 weight even when name-derived weight fell back to Regular', () => {
    const result = readOS2(
      {
        'OS/2': {
          usWeightClass: 800,
          usWidthClass: 9,
          sFamilyClass: 0,
          fsSelection: { regular: true, italic: false },
        },
      },
      { weight: 400 }
    );

    expect(result.weight).toBe(800);
  });
});

import { describe, expect, it } from 'vitest';
import {
  keyboardSliderValue,
  snapSliderValue,
  valueToPercentage,
} from '@/components/ui/elasticSliderMath';

describe('elastic slider math', () => {
  it('snaps values to the configured step and clamps both ends', () => {
    expect(snapSliderValue(6.26, 0, 10, 0.5)).toBe(6.5);
    expect(snapSliderValue(-2, 0, 10, 1)).toBe(0);
    expect(snapSliderValue(14, 0, 10, 1)).toBe(10);
    expect(valueToPercentage(15, 10, 30)).toBe(25);
  });

  it('moves one step with every arrow direction', () => {
    const input = { value: 50, min: 0, max: 100, step: 2, shiftKey: false };

    expect(keyboardSliderValue({ ...input, key: 'ArrowRight' })).toBe(52);
    expect(keyboardSliderValue({ ...input, key: 'ArrowUp' })).toBe(52);
    expect(keyboardSliderValue({ ...input, key: 'ArrowLeft' })).toBe(48);
    expect(keyboardSliderValue({ ...input, key: 'ArrowDown' })).toBe(48);
  });

  it('moves ten steps when Shift modifies an arrow key', () => {
    expect(keyboardSliderValue({
      key: 'ArrowRight', value: 50, min: 0, max: 100, step: 2, shiftKey: true,
    })).toBe(70);
  });

  it('moves directly to the range ends with Home and End', () => {
    const input = { value: 50, min: 12, max: 200, step: 1, shiftKey: false };

    expect(keyboardSliderValue({ ...input, key: 'Home' })).toBe(12);
    expect(keyboardSliderValue({ ...input, key: 'End' })).toBe(200);
    expect(keyboardSliderValue({ ...input, key: 'PageDown' })).toBeNull();
  });
});

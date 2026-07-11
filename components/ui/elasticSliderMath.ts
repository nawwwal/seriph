interface KeyboardSliderInput {
  key: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shiftKey: boolean;
}

export function clampSliderValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function snapSliderValue(value: number, min: number, max: number, step: number): number {
  if (step <= 0) return clampSliderValue(value, min, max);
  const snapped = Math.round((value - min) / step) * step + min;
  return clampSliderValue(Number(snapped.toFixed(6)), min, max);
}

export function valueToPercentage(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 0;
  return clampSliderValue(((value - min) / span) * 100, 0, 100);
}

export function pointerValue(
  clientX: number,
  rect: Pick<DOMRect, 'left' | 'width'>,
  min: number,
  max: number,
  step: number
): number {
  const progress = clampSliderValue((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  return snapSliderValue(min + progress * (max - min), min, max, step);
}

export function keyboardSliderValue(input: KeyboardSliderInput): number | null {
  if (input.key === 'Home') return input.min;
  if (input.key === 'End') return input.max;
  const direction = input.key === 'ArrowRight' || input.key === 'ArrowUp'
    ? 1
    : input.key === 'ArrowLeft' || input.key === 'ArrowDown'
      ? -1
      : 0;
  if (direction === 0) return null;
  const multiplier = input.shiftKey ? 10 : 1;
  return snapSliderValue(
    input.value + direction * input.step * multiplier,
    input.min,
    input.max,
    input.step
  );
}

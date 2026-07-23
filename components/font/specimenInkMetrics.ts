const SAMPLE_PADDING = 2;
const ALPHA_THRESHOLD = 24;
const MAX_GROWTH = 2.2;
const MAX_FRAME_INK_COVERAGE = 0.3;
const MAX_GROWN_INK_COVERAGE = 0.12;
const MIN_DENSE_FACE_SCALE = 0.78;
const MIN_GROWN_DENSE_SCALE = 0.65;

/** Estimate how densely a font fills the visible bounds of one specimen. */
export function measureSpecimenInkDensity(
  element: HTMLElement,
  text: string,
): number | undefined {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;

  const style = getComputedStyle(element);
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.font = font;
  const metrics = context.measureText(text);
  const inkWidth = Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
  const inkHeight = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
  if (inkWidth <= 0 || inkHeight <= 0) return undefined;

  canvas.width = inkWidth + SAMPLE_PADDING * 2;
  canvas.height = inkHeight + SAMPLE_PADDING * 2;
  context.font = font;
  context.fillStyle = '#000';
  context.textBaseline = 'alphabetic';
  context.fillText(
    text,
    SAMPLE_PADDING + metrics.actualBoundingBoxLeft,
    SAMPLE_PADDING + metrics.actualBoundingBoxAscent,
  );

  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let inkPixels = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > ALPHA_THRESHOLD) inkPixels += 1;
    }
    return inkPixels / (inkWidth * inkHeight);
  } catch {
    return undefined;
  }
}

interface SpecimenScaleInput {
  allowGrowth: boolean;
  frame: HTMLElement;
  minFill: number;
  preferredScale: number;
  targetFill: number;
  text: string;
  textElement: HTMLElement;
}

/** Calculate one bounded optical correction from rendered font metrics. */
export function calculateSpecimenScale({
  allowGrowth,
  frame,
  minFill,
  preferredScale,
  targetFill,
  text,
  textElement,
}: SpecimenScaleInput): number {
  const fill = textElement.offsetWidth / frame.clientWidth;
  let scale = Math.min(
    preferredScale,
    (frame.clientWidth - 1) / textElement.offsetWidth,
  );
  if (allowGrowth && scale === 1 && fill < minFill) {
    scale = Math.min(MAX_GROWTH, targetFill / fill);
  }

  const density = measureSpecimenInkDensity(textElement, text);
  if (density === undefined || (!allowGrowth && preferredScale > 1)) return scale;
  const heightFill = Math.min(1, textElement.offsetHeight / frame.clientHeight);
  const fittedCoverage = density * Math.min(1, fill) * heightFill * scale * scale;
  const coverageLimit = scale > 1
    ? MAX_GROWN_INK_COVERAGE
    : MAX_FRAME_INK_COVERAGE;
  if (fittedCoverage <= coverageLimit) return scale;
  const densityFloor = scale > 1 ? MIN_GROWN_DENSE_SCALE : MIN_DENSE_FACE_SCALE;
  return scale * Math.max(densityFloor, Math.sqrt(coverageLimit / fittedCoverage));
}

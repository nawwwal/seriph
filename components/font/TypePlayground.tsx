'use client';

import type { RefObject } from 'react';
import type { FontFamily } from '@/models/font.models';
import TypePlaygroundActions from './TypePlaygroundActions';
import TypePlaygroundControls from './TypePlaygroundControls';
import TypePlaygroundEditor from './TypePlaygroundEditor';
import TypePlaygroundStyleSelect from './TypePlaygroundStyleSelect';
import {
  buildVariationSettings,
  isItalicFace,
  serializePlaygroundCss,
} from './typePlaygroundModel';
import { resetFaceState } from './typePlaygroundState';
import { letterSpacingCss, lineHeightCss } from './typePlaygroundUnits';
import { copyTextWithFallback } from './typePlaygroundCopy';
import { useTypePlayground } from './typePlaygroundHooks';

interface TypePlaygroundProps {
  family: FontFamily;
  testerRef: RefObject<HTMLDivElement | null>;
}

export default function TypePlayground({ family, testerRef }: TypePlaygroundProps) {
  const pg = useTypePlayground(family);
  const { selectedFace, faceState, axes, fonts } = pg;
  if (!selectedFace || !faceState) return null;

  const variations = buildVariationSettings(axes, faceState.axisValues);
  const cssFamily = axes.length
    ? `'${pg.variableFamily}'`
    : pg.fixedRegistration
      ? `'${pg.fixedRegistration.cssFamily}'`
      : family.name;

  const copyCss = async () => {
    const css = serializePlaygroundCss({
      familyName: family.name,
      face: selectedFace,
      state: faceState,
    });
    pg.flashCopyLabel(await copyTextWithFallback(css));
  };

  // Toolbar (style + actions) → specimen → sliders.
  return (
    <div ref={testerRef} className="mt-8">
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        <TypePlaygroundStyleSelect
          fonts={fonts}
          value={selectedFace.id}
          onChange={pg.selectFace}
        />
        <div className="ml-auto">
          <TypePlaygroundActions
            copyLabel={pg.copyLabel}
            onReset={() => pg.patchFace(resetFaceState(selectedFace, family.name))}
            onCopy={() => void copyCss()}
          />
        </div>
      </div>
      <TypePlaygroundEditor
        value={faceState.text}
        onChange={(text) => pg.patchFace({ text })}
        fontFamily={cssFamily}
        fontWeight={
          axes.length
            ? Math.round(faceState.axisValues.wght ?? selectedFace.weight)
            : selectedFace.weight
        }
        fontStyle={axes.length ? 'normal' : isItalicFace(selectedFace) ? 'italic' : 'normal'}
        fontSize={faceState.fontSize}
        letterSpacing={letterSpacingCss(faceState.letterSpacingValue, faceState.letterSpacingMode)}
        lineHeight={lineHeightCss(faceState.lineHeightValue, faceState.lineHeightMode)}
        fontVariationSettings={variations}
        familyId={family.id}
      />
      <section className="mt-6">
        <div className="rounded-[var(--radius)] rule p-4 pt-[8px] sm:p-6 sm:pt-[8px]">
          <TypePlaygroundControls
            state={faceState}
            axes={axes}
            onPatch={pg.patchFace}
            onAxisChange={(tag, value) =>
              pg.patchFace({ axisValues: { ...faceState.axisValues, [tag]: value } })
            }
          />
        </div>
      </section>
    </div>
  );
}

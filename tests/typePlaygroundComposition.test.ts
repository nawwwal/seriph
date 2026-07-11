import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TypePlaygroundEditor from '@/components/font/TypePlaygroundEditor';
import ElasticSliderValue from '@/components/ui/ElasticSliderValue';

const repoRoot = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

describe('unified type playground composition', () => {
  it('uses the specimen container as an LTR editable preview', () => {
    const markup = renderToStaticMarkup(createElement(TypePlaygroundEditor, {
      value: 'ABC', onChange: () => {}, fontFamily: 'Inter', fontWeight: 400,
      fontStyle: 'normal', fontSize: 48, letterSpacing: '0em', lineHeight: 'normal',
    }));

    expect(markup).toContain('dir="ltr"');
    expect(markup).toContain('specimen-container');
    expect(markup).toContain('>ABC</textarea>');
  });

  it('keys style selection by face ID dropdown and limits axes to the selected face', () => {
    const hooks = read('components/font/typePlaygroundHooks.ts');
    const selector = read('components/font/TypePlaygroundStyleSelect.tsx');
    const sliders = read('components/font/typePlaygroundSliders.tsx');

    expect(selector).toContain('option.id');
    expect(selector).toContain('Select.Root');
    expect(selector).toContain('Select.Item');
    expect(selector).not.toContain('filterTiny');
    expect(hooks).toContain('selectedFaceId');
    expect(hooks).toContain('variableAxes');
    expect(sliders).toContain('axes.map');
  });

  it('uses stable Reset, Copy CSS, and Copied action labels', () => {
    const playground = read('components/font/TypePlayground.tsx');
    const actions = read('components/font/TypePlaygroundActions.tsx');
    const copy = read('components/font/typePlaygroundCopy.ts');

    expect(actions).toContain('Reset');
    expect(actions).toContain('Copy CSS');
    expect(playground).toContain('TypePlaygroundActions');
    expect(playground).toContain('flashCopyLabel');
    expect(playground).toContain('copyTextWithFallback');
    expect(copy).toContain('copyTextWithFallback');
  });

  it('uses explicit em tracking and distinct numeric input names', () => {
    const sliders = read('components/font/typePlaygroundSliders.tsx');
    const markup = renderToStaticMarkup(createElement(ElasticSliderValue, {
      inputId: 'font-size', label: 'Font size', value: 48, min: 12, max: 200,
      step: 1, unit: 'px', onChange: () => {},
    }));

    expect(sliders).toContain("['em', 'px']");
    expect(markup).toContain('aria-label="Font size value"');
  });

  it('cancels numeric edits on Escape without triggering a blur commit', () => {
    const valueInput = read('components/ui/ElasticSliderValue.tsx');
    const escapeBranch = valueInput.slice(valueInput.indexOf("event.key === 'Escape'"));

    expect(escapeBranch).toContain('event.preventDefault()');
    expect(escapeBranch.slice(0, escapeBranch.indexOf('inputMode'))).not.toContain('.blur()');
  });

  it('folds specimen into the playground and drops the Type Playground heading', () => {
    const detail = read('components/font/FamilyDetailContent.tsx');
    const playground = read('components/font/TypePlayground.tsx');
    const playgroundIdx = detail.indexOf('<TypePlayground');
    const usePanel = detail.indexOf('<UseFontPanel');

    expect(detail.match(/<TypePlayground/g)).toHaveLength(1);
    expect(detail).not.toContain('<Specimen');
    expect(playgroundIdx).toBeLessThan(usePanel);
    expect(playground).not.toContain('Type Playground');
    expect(playground).toContain('TypePlaygroundEditor');
    expect(detail).not.toContain('TypeTester');
    expect(detail).not.toContain('VariableFontPlayground');
  });

  it('retains insights, preview skeletons, detail sections, and tester targeting', () => {
    const detail = read('components/font/FamilyDetailContent.tsx');

    for (const contract of [
      'FamilyHeader', 'FamilyInsights', 'FamilyDetailSampleMorph', 'SkeletonTester', 'SkeletonStyles',
      'SkeletonFooter', 'FamilyStyles', 'CharacterSetSection', 'FamilyFooter', 'testerRef={testerRef}',
    ]) {
      expect(detail).toContain(contract);
    }
  });

  it('places style toolbar above the specimen and unit modes left of the value field', () => {
    const playground = read('components/font/TypePlayground.tsx');
    const selector = read('components/font/TypePlaygroundStyleSelect.tsx');
    const sliders = read('components/font/typePlaygroundSliders.tsx');
    const body = playground.slice(playground.indexOf('return ('));
    const styleIdx = body.indexOf('<TypePlaygroundStyleSelect');
    const actionsIdx = body.indexOf('<TypePlaygroundActions');
    const editorIdx = body.indexOf('<TypePlaygroundEditor');
    const controlsIdx = body.indexOf('<TypePlaygroundControls');

    expect(styleIdx).toBeGreaterThan(-1);
    expect(styleIdx).toBeLessThan(actionsIdx);
    expect(actionsIdx).toBeLessThan(editorIdx);
    expect(editorIdx).toBeLessThan(controlsIdx);
    expect(selector).not.toContain('>Style<');
    expect(sliders).toContain('valuePrefix');
    expect(sliders).toContain("['em', 'px']");
  });
});

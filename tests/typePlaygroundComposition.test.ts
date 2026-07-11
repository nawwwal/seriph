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
  it('keeps the editable preview explicitly left to right', () => {
    const markup = renderToStaticMarkup(createElement(TypePlaygroundEditor, {
      value: 'ABC', onChange: () => {}, fontFamily: 'Inter', fontWeight: 400,
      fontStyle: 'normal', fontSize: 48, letterSpacing: '0em', lineHeight: 'normal',
    }));

    expect(markup).toContain('dir="ltr"');
    expect(markup).toContain('>ABC</textarea>');
  });

  it('keys style selection by face ID and limits axes to the selected face', () => {
    const playground = read('components/font/TypePlayground.tsx');
    const selector = read('components/font/TypePlaygroundStyleSelect.tsx');
    const controls = read('components/font/TypePlaygroundControls.tsx');

    expect(selector).toContain('value={font.id}');
    expect(playground).toContain('selectedFaceId');
    expect(playground).toContain('selectedFace.variableAxes');
    expect(controls).toContain('axes.map');
  });

  it('uses stable Reset, Copy CSS, and Copied action labels', () => {
    const playground = read('components/font/TypePlayground.tsx');
    const controls = read('components/font/TypePlaygroundControls.tsx');

    expect(controls).toContain('Reset');
    expect(controls).toContain('Copy CSS');
    expect(playground).toContain("setCopyLabel('Copied')");
    expect(playground).toContain("setCopyLabel('Copy failed')");
    expect(playground).toContain('copyTextWithFallback');
  });

  it('uses explicit em tracking and distinct numeric input names', () => {
    const controls = read('components/font/TypePlaygroundControls.tsx');
    const markup = renderToStaticMarkup(createElement(ElasticSliderValue, {
      inputId: 'font-size', label: 'Font size', value: 48, min: 12, max: 200,
      step: 1, unit: 'px', onChange: () => {},
    }));

    expect(controls).toContain("['em', 'px']");
    expect(markup).toContain('aria-label="Font size value"');
  });

  it('cancels numeric edits on Escape without triggering a blur commit', () => {
    const valueInput = read('components/ui/ElasticSliderValue.tsx');
    const escapeBranch = valueInput.slice(valueInput.indexOf("event.key === 'Escape'"));

    expect(escapeBranch).toContain('event.preventDefault()');
    expect(escapeBranch.slice(0, escapeBranch.indexOf('inputMode'))).not.toContain('.blur()');
  });

  it('replaces both legacy detail testers with one correctly ordered playground', () => {
    const detail = read('components/font/FamilyDetailContent.tsx');
    const specimen = detail.indexOf('<Specimen');
    const playground = detail.indexOf('<TypePlayground');
    const usePanel = detail.indexOf('<UseFontPanel');

    expect(detail.match(/<TypePlayground/g)).toHaveLength(1);
    expect(specimen).toBeLessThan(playground);
    expect(playground).toBeLessThan(usePanel);
    expect(detail).not.toContain('TypeTester');
    expect(detail).not.toContain('VariableFontPlayground');
  });

  it('retains insights, preview skeletons, detail sections, and tester targeting', () => {
    const detail = read('components/font/FamilyDetailContent.tsx');

    for (const contract of ['FamilyHeader', 'FamilyInsights', 'SkeletonTester', 'SkeletonStyles',
      'SkeletonFooter', 'FamilyStyles', 'CharacterSetSection', 'FamilyFooter', 'testerRef={testerRef}']) {
      expect(detail).toContain(contract);
    }
  });
});

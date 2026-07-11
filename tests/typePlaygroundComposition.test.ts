import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TypePlaygroundEditor from '@/components/font/TypePlaygroundEditor';

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
  });
});

'use client';

import { useState } from 'react';
import { FontFamily } from '@/models/font.models';

interface TypeTesterProps {
  family: FontFamily;
}

export default function TypeTester({ family }: TypeTesterProps) {
  const [selectedStyle, setSelectedStyle] = useState(family.fonts[0]?.subfamily || 'Regular');
  const [fontSize, setFontSize] = useState('24px');
  const [testText, setTestText] = useState(
    `Type here to test ${family.name}. This editable area allows you to see how the font renders at different sizes and weights.`
  );

  const selectedFont = family.fonts.find((f) => f.subfamily === selectedStyle) || family.fonts[0];

  return (
    <section className="mt-10">
      <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Type Tester</h2>
      <div className="mt-6 rule p-6 rounded-[var(--radius)]">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div className="flex gap-3 flex-wrap">
            <select
              className="rule bg-transparent p-2 rounded-[var(--radius)] uppercase text-sm font-bold cursor-pointer"
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
            >
              {family.fonts.map((font) => (
                <option key={font.id} value={font.subfamily}>
                  {font.subfamily}
                </option>
              ))}
            </select>
            <select
              className="rule bg-transparent p-2 rounded-[var(--radius)] uppercase text-sm font-bold cursor-pointer"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
            >
              <option>16px</option>
              <option>18px</option>
              <option>24px</option>
              <option>32px</option>
              <option>48px</option>
              <option>64px</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setTestText(
                  `Type here to test ${family.name}. This editable area allows you to see how the font renders at different sizes and weights.`
                )
              }
              className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink"
            >
              Reset
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(testText)}
              className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink"
            >
              Copy
            </button>
          </div>
        </div>
        <div
          contentEditable="true"
          className="outline-none text-2xl min-h-[100px]"
          style={{ fontFamily: family.name, fontSize }}
          suppressContentEditableWarning
          onInput={(e) => setTestText(e.currentTarget.textContent || '')}
        >
          {testText}
        </div>
      </div>
    </section>
  );
}


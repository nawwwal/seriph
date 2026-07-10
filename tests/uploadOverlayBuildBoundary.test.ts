import { afterEach, describe, expect, it } from 'vitest';
import {
  modalAsset,
  removeOverlayFixtures,
  runOverlayVerifier,
  writeOverlayFixture,
} from './uploadOverlayBuildFixture';

afterEach(removeOverlayFixtures);

describe('upload overlay build boundary', () => {
  it('accepts both emitted asset path forms when the modal stays deferred', () => {
    const output = runOverlayVerifier(
      writeOverlayFixture(['/_next/static/chunks/app-shell.js', 'static/chunks/route.js'])
    );

    expect(output).toContain('Upload Center modal remains deferred');
  });

  it('reads entryJSFiles without treating an unrelated manifest field as initial', () => {
    expect(runOverlayVerifier(writeOverlayFixture([], true, true))).toContain('remains deferred');
  });

  it.each([`/_next/${modalAsset}`, modalAsset])(
    'rejects an initial modal entry using %s',
    (entry) => {
      expect(() => runOverlayVerifier(writeOverlayFixture([entry]))).toThrow(
        'Upload Center modal was included in initial route bundle(s)'
      );
    }
  );

  it('rejects an unregistered deferred modal chunk', () => {
    expect(() => runOverlayVerifier(writeOverlayFixture([], false))).toThrow(
      'Upload Center modal chunk is not registered in any react-loadable manifest'
    );
  });
});

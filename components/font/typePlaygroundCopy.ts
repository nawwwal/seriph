/** Clipboard write with a hidden-textarea fallback for restricted contexts. */
export async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      input.remove();
    }
  }
}

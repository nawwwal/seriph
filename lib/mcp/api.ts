interface Envelope<T> {
  data?: T;
  error?: { message?: string };
}

export async function mcpFetchJson<T>(path: string, getIdToken: () => Promise<string>, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getIdToken()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json = (await response.json()) as Envelope<T>;
  if (!response.ok) throw new Error(json.error?.message || `Request failed: ${response.status}`);
  if (json.data === undefined) throw new Error('Empty response');
  return json.data;
}

export function publicFontUrl(url: string): boolean {
  try {
    const path = new URL(url, 'https://seriph.web.app').pathname;
    return path.startsWith('/s/') || path.startsWith('/d/');
  } catch {
    return false;
  }
}

export const rawFamily = {
  id: 'inter',
  name: 'Inter',
  normalizedName: 'inter',
  description: '',
  tags: [],
  classification: 'Sans Serif',
  metadata: {},
  fonts: [{ id: 'regular', subfamily: 'Regular', weight: 400, metadata: {} }],
  uploadDate: '2026-07-01T00:00:00.000Z',
  lastModified: '2026-07-01T00:00:00.000Z',
};

export async function successfulFamilyResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: { family: rawFamily } }),
  };
}

export async function failedFamilyResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message } }),
  };
}

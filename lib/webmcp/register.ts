import { getModelContext, type ModelContext, type WebMcpTool } from '@/lib/webmcp/modelContext';

async function waitForModelContext(signal: AbortSignal): Promise<ModelContext | null> {
  const started = Date.now();
  while (!signal.aborted) {
    const context = getModelContext();
    if (context) return context;
    if (Date.now() - started > 8000) return null;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

export async function registerSeriphWebMcp(tools: WebMcpTool[], signal: AbortSignal): Promise<void> {
  const context = await waitForModelContext(signal);
  if (!context || signal.aborted) return;
  for (const tool of tools) {
    if (signal.aborted) return;
    await context.registerTool(tool, { signal });
  }
}

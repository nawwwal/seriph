export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean; consequentialHint?: boolean };
}

export interface ModelContext {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<unknown> | unknown;
  getTools?: () => Promise<unknown[]>;
  executeTool?: (tool: unknown, input: string, options?: { signal?: AbortSignal }) => Promise<unknown>;
}

/** Feature-detect the WebMCP host. Prefer document; navigator is deprecated. */
export function getModelContext(): ModelContext | null {
  if (typeof document === 'undefined') return null;
  const fromDocument = (document as Document & { modelContext?: ModelContext }).modelContext;
  const fromNavigator = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
  const context = fromDocument ?? fromNavigator;
  return context && 'registerTool' in context && typeof context.registerTool === 'function' ? context : null;
}

export function createSourceProgressBridge(
  publish: (sourceId: string, percent: number | null) => void,
  local: (sourceId: string, percent: number | null) => void,
) {
  return (sourceId: string, percent: number | null) => { publish(sourceId, percent); local(sourceId, percent); };
}


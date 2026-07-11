export function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function facetLabel(label: string, count: number): string {
  return `${label} ${count}`;
}

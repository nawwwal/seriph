export function familySlug(name: string): string {
  return (
    (name || "unknown")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

export function familyFileBase(name: string): string {
  return (name || "Unknown").replace(/[^A-Za-z0-9]/g, "") || "Unknown";
}

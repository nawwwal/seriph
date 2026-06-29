import { firstString, isRecord, recordAt } from "./tableAccess";

export interface NameExtras {
  designer?: string;
  description?: string;
  licenseUrl?: string;
  licenseDescription?: string;
  url?: string;
  sampleText?: string;
  preferredFamily?: string;
  preferredSubfamily?: string;
  wwsFamilyName?: string;
  wwsSubfamilyName?: string;
  fullName?: string;
}

function nameRecords(font: unknown): Record<string, unknown> | undefined {
  if (!isRecord(font)) return undefined;
  const names = recordAt(font, "names");
  if (names) return names;
  const records = recordAt(recordAt(font, "name") ?? {}, "records");
  return records;
}

export function readNameExtras(font: unknown): NameExtras {
  const names = nameRecords(font);
  if (!names) return {};
  const pick = (key: string) => firstString(names[key]);
  const out: NameExtras = {};
  const entries: Array<[keyof NameExtras, string | undefined]> = [
    ["designer", pick("designer")],
    ["description", pick("description")],
    ["licenseUrl", pick("licenseURL")],
    ["licenseDescription", pick("licenseDescription") ?? pick("license")],
    ["url", pick("manufacturerURL") ?? pick("vendorURL")],
    ["sampleText", pick("sampleText")],
    ["preferredFamily", pick("preferredFamily")],
    ["preferredSubfamily", pick("preferredSubfamily")],
    ["wwsFamilyName", pick("wwsFamilyName")],
    ["wwsSubfamilyName", pick("wwsSubfamilyName")],
    ["fullName", pick("fullName")],
  ];
  for (const [key, value] of entries) {
    if (value) out[key] = value;
  }
  return out;
}

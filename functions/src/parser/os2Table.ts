import { isRecord, numberAt, recordAt, stringAt, type LooseRecord } from "./tableAccess";

export interface OS2ReadResult {
  weight?: number;
  foundry?: string;
  classification?: string;
  unicodeRanges: string[];
  codepageRanges: string[];
  vendorId?: string;
  panose?: unknown[];
  xHeight?: number;
  capHeight?: number;
  typoAscender?: number;
  typoDescender?: number;
  fsType?: number;
}

function os2Table(font: LooseRecord): LooseRecord | undefined {
  return recordAt(font, "OS2") ?? recordAt(font, "OS/2") ?? recordAt(recordAt(font, "tables") ?? {}, "os2") ?? recordAt(recordAt(font, "tables") ?? {}, "OS2");
}

function familyClassName(value: number): string | undefined {
  const mainClass = value >> 8;
  if ([1, 2, 3, 4, 5, 7].includes(mainClass)) return "Serif";
  if (mainClass === 8) return "Sans Serif";
  if (mainClass === 9) return "Display & Decorative";
  if (mainClass === 10) return "Script & Handwriting";
  if (mainClass === 12) return "Symbol & Icon";
  return undefined;
}

export function readOS2(font: unknown, current: { weight?: number; foundry?: string }): OS2ReadResult {
  const out: OS2ReadResult = { weight: current.weight, foundry: current.foundry, unicodeRanges: [], codepageRanges: [] };
  if (!isRecord(font)) return out;
  const os2 = os2Table(font);
  if (!os2) return out;
  const classification = numberAt(os2, "sFamilyClass");
  if (classification) out.classification = familyClassName(classification);
  out.weight = numberAt(os2, "usWeightClass") ?? out.weight;
  out.foundry = out.foundry ?? stringAt(os2, "achVendID");
  out.vendorId = stringAt(os2, "achVendID");
  const panose = os2.panose;
  if (panose && typeof panose === "object" && Symbol.iterator in Object(panose)) out.panose = Array.from(panose as Iterable<unknown>);
  out.xHeight = numberAt(os2, "sxHeight");
  out.capHeight = numberAt(os2, "sCapHeight");
  out.typoAscender = numberAt(os2, "sTypoAscender");
  out.typoDescender = numberAt(os2, "sTypoDescender");
  out.fsType = numberAt(os2, "fsType");
  if (numberAt(os2, "ulUnicodeRange1") !== undefined || numberAt(os2, "ulUnicodeRange2") !== undefined) {
    out.unicodeRanges = [1, 2, 3, 4].map((index) => `U+${(numberAt(os2, `ulUnicodeRange${index}`) ?? 0).toString(16)}`);
  }
  return out;
}

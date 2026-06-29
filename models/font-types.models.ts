export type Classification =
  | "Serif"
  | "Sans Serif"
  | "Script & Handwriting"
  | "Monospace"
  | "Display & Decorative"
  | "Symbol & Icon";

export type FontFormat = "TTF" | "OTF" | "WOFF" | "WOFF2" | "EOT";

export type FontStyle =
  | "Thin"
  | "ExtraLight"
  | "Light"
  | "Regular"
  | "Medium"
  | "SemiBold"
  | "Bold"
  | "ExtraBold"
  | "Black"
  | "Italic"
  | "Thin Italic"
  | "ExtraLight Italic"
  | "Light Italic"
  | "Regular Italic"
  | "Medium Italic"
  | "SemiBold Italic"
  | "Bold Italic"
  | "ExtraBold Italic"
  | "Black Italic";

export interface VariableAxis {
  tag: string;
  name: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
}

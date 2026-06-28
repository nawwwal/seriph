/** Extract naming, weight/style, and variable-axis info from a parsed font. */
export function extractNaming(font: any) {
  let familyName = "Unknown Family";
  let subfamilyName = "Regular";
  let postScriptName = "UnknownPSName";
  let version = "N/A";
  let copyright = "N/A";
  let trademark = "N/A";
  let foundry: string | undefined;

  if ("familyName" in font && typeof font.familyName === "string") familyName = font.familyName;
  else if ("names" in font && font.names.fontFamily?.en) familyName = font.names.fontFamily.en;

  if ("subfamilyName" in font && typeof font.subfamilyName === "string") subfamilyName = font.subfamilyName;
  else if ("names" in font && font.names.fontSubfamily?.en) subfamilyName = font.names.fontSubfamily.en;

  if ("postscriptName" in font && typeof font.postscriptName === "string") postScriptName = font.postscriptName;
  else if ("names" in font && font.names.postScriptName?.en) postScriptName = font.names.postScriptName.en;

  if ("version" in font && typeof font.version === "string") version = font.version;
  else if ("names" in font && font.names.version?.en) version = font.names.version.en;

  if ("copyright" in font && typeof font.copyright === "string") copyright = font.copyright;
  else if ("names" in font && font.names.copyright?.en) copyright = font.names.copyright.en;

  if ("trademark" in font && typeof font.trademark === "string") trademark = font.trademark;
  else if ("names" in font && font.names.trademark?.en) trademark = font.names.trademark.en;

  if ("designer" in font && typeof font.designer === "string") foundry = font.designer;
  else if ("manufacturer" in font && typeof font.manufacturer === "string") foundry = font.manufacturer;
  else if ("names" in font && font.names.manufacturer?.en) foundry = font.names.manufacturer.en;

  const lowerSubfamily = subfamilyName.toLowerCase();
  let style: string | undefined;
  let weight: number | undefined;
  if (lowerSubfamily.includes("italic")) style = "Italic";
  if (lowerSubfamily.includes("bold")) weight = 700;
  else if (lowerSubfamily.includes("light")) weight = 300;
  else if (lowerSubfamily.includes("medium")) weight = 500;
  else if (lowerSubfamily.includes("black")) weight = 900;
  else if (lowerSubfamily.includes("thin")) weight = 100;
  else weight = 400;

  let isVariable = false;
  let variableAxes: any[] = [];
  if ("variationAxes" in font && font.variationAxes && Object.keys(font.variationAxes).length > 0) {
    isVariable = true;
    variableAxes = Object.entries(font.variationAxes).map(([tag, axis]) => ({
      tag,
      name: (axis as any).name || tag,
      minValue: (axis as any).min,
      maxValue: (axis as any).max,
      defaultValue: (axis as any).default,
    }));
  }

  return {
    familyName, subfamilyName, postScriptName, version, copyright, trademark,
    foundry, weight, style, isVariable, variableAxes, lowerSubfamily,
  };
}

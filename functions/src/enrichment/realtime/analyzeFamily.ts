import type { Firestore } from "firebase-admin/firestore";
import { buildPrompt, buildEnrichmentUpdate, composeEnrichment, renderFamilySpecimen } from "../../ai/enrichFont";
import { hasCurrentAnalysis } from "../../ai/enrich/parse";
import { pairFamilyWithJev } from "../../ai/jev/pairing/select";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { analysisModelId, batchClient, batchGenerationConfig, SAFETY_SETTINGS } from "../../ingest/batch/client";

export async function enrichmentUpdateForRealtime(db: Firestore, family: FontFamilyDoc): Promise<Record<string, unknown>> {
  let enrichment = hasCurrentAnalysis(family) ? family.enrichment : undefined;
  if (!enrichment) {
    const specimen = await renderFamilySpecimen(family);
    const parts: Array<Record<string, unknown>> = [];
    if (specimen) parts.push({ inlineData: { mimeType: "image/png", data: specimen.toString("base64") } });
    parts.push({ text: buildPrompt(family, Boolean(specimen)) });
    const response = await batchClient().models.generateContent({
      model: analysisModelId(), contents: [{ role: "user", parts }],
      config: { ...batchGenerationConfig(), safetySettings: SAFETY_SETTINGS },
    } as never);
    enrichment = await composeEnrichment(family, response.text) ?? undefined;
  }
  if (!enrichment) throw new Error("invalid_model_output");
  return buildEnrichmentUpdate(family, await pairFamilyWithJev(db, family, enrichment));
}

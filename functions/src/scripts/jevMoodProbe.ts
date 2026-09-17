import { evaluateSystemOne } from "../ai/jev/client";
import { catalogLabelQuestions } from "../ai/jev/questions";
import { mapsFromResult } from "../ai/jev/label";

async function run(): Promise<void> {
  const summary = process.argv.slice(2).join(" ").trim()
    || "A warm humanist serif with modest contrast, suited to long editorial reading and quiet branding.";
  const result = await evaluateSystemOne({
    family: { name: "Probe Serif", classification: "Serif", foundry: null, styles: ["Regular"] },
    summary,
    voice: "warm and literary",
    geminiMoods: ["warm"],
    geminiUseCases: ["editorial"],
  }, catalogLabelQuestions());
  console.log(JSON.stringify({ summary, model: result.model, ...mapsFromResult(result, 0.5) }, null, 2));
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

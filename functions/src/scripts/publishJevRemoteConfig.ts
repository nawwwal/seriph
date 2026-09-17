import { getRemoteConfig } from "firebase-admin/remote-config";

async function run(): Promise<void> {
  const remoteConfig = getRemoteConfig();
  const template = await remoteConfig.getTemplate();
  template.parameterGroups ||= {};
  template.parameterGroups.Server ||= { parameters: {} };
  const server = template.parameterGroups.Server.parameters;
  const flags: Record<string, { defaultValue: { value: string }; valueType: "BOOLEAN" | "STRING" | "NUMBER" }> = {
    jev_enrichment_enabled: { defaultValue: { value: "true" }, valueType: "BOOLEAN" },
    jev_search_intent_enabled: { defaultValue: { value: "true" }, valueType: "BOOLEAN" },
    jev_search_rerank_enabled: { defaultValue: { value: "true" }, valueType: "BOOLEAN" },
    jev_verify_enabled: { defaultValue: { value: "true" }, valueType: "BOOLEAN" },
    jev_pairing_enabled: { defaultValue: { value: "true" }, valueType: "BOOLEAN" },
    jev_merge_suggest_enabled: { defaultValue: { value: "true" }, valueType: "BOOLEAN" },
    jev_model_name: { defaultValue: { value: "jev-1.13.0" }, valueType: "STRING" },
    jev_noul_threshold: { defaultValue: { value: "0.5" }, valueType: "NUMBER" },
    jev_mood_threshold: { defaultValue: { value: "0.7" }, valueType: "NUMBER" },
    jev_intent_confidence_min: { defaultValue: { value: "0.5" }, valueType: "NUMBER" },
  };
  Object.assign(server, flags);
  const published = await remoteConfig.publishTemplate(template);
  console.log(JSON.stringify({
    version: published.version?.versionNumber,
    flags: Object.fromEntries(Object.entries(flags).map(([key, value]) => [key, value.defaultValue.value])),
  }, null, 2));
}

if (require.main === module) {
  import("../bootstrap/adminApp")
    .then(() => run())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

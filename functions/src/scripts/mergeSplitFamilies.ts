export { buildSplitFamilyMergePlan } from "./mergeSplitFamiliesPlan";
export { runMergeSplitFamilies } from "./mergeSplitFamiliesRunner";
export { parseMergeArgs } from "./mergeSplitFamiliesTypes";
export type {
  AliasPlan,
  MergeArgs,
  MergeConflict,
  MergeTarget,
  SplitFamilyMergePlan,
} from "./mergeSplitFamiliesTypes";

if (require.main === module) {
  import("./mergeSplitFamiliesRunner").then(({ runMergeSplitFamilies }) => runMergeSplitFamilies()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

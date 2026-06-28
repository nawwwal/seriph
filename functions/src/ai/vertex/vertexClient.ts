import { getConfigBoolean } from "../../config/remoteConfig";
import { RC_KEYS } from "../../config/rcKeys";

/** Kill-switch for all AI enrichment. Read from Remote Config (default off). */
export function isVertexEnabled(): boolean {
  return getConfigBoolean(RC_KEYS.isVertexEnabled, false);
}

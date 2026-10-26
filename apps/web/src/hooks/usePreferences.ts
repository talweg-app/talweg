import { useSyncExternalStore } from "react";
import { readPreferences, subscribePreferences } from "../utils/preferences.js";
export function usePreferences() {
  return useSyncExternalStore(
    subscribePreferences,
    readPreferences,
    readPreferences,
  );
}

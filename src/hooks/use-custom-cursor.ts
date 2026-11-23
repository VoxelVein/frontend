import { useSyncExternalStore } from "react";

import {
  readCustomCursorEnabled,
  setCustomCursorEnabled,
  subscribeToCustomCursor,
} from "@/lib/custom-cursor";

/** The server cannot know a localStorage value; render the default there. */
const getServerSnapshot = (): boolean => true;

export const useCustomCursor = () => ({
  customCursorEnabled: useSyncExternalStore(
    subscribeToCustomCursor,
    readCustomCursorEnabled,
    getServerSnapshot
  ),
  setCustomCursorEnabled,
});

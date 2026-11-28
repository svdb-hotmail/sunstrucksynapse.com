import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

/** Keep the server and first hydration render identical before using browser APIs. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}

import { useSyncExternalStore } from "react";

// SSR-safe "are we on the client yet" flag. Returns false during SSR and the hydration render
// (so it matches the server markup), then true once mounted — without setState-in-effect, which
// the lint rules forbid and which cascades renders. Used to defer reduced-motion branching past
// hydration so the animated and static variants never disagree at hydration time.
const subscribe = () => () => {};

export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}

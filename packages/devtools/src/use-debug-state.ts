export function useDebugState(state: unknown) {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as any).__DEBUG_STATE__ = state;
  }
}

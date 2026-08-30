import type { RefObject } from "react";

declare module "react" {
  // The landing page checks these DOM refs before starting its async animation.
  // Preserve that runtime guard while allowing the guarded refs inside the loop.
  function useRef<T>(initialValue: null): RefObject<T>;
}

export {};

/// <reference types="vite/client" />

import type { DefensityApi } from "../shared/types";

declare global {
  interface Window {
    defensity: DefensityApi;
  }
}

export {};

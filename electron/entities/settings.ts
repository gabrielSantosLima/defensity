export interface EngineSettings {
  dockerHost: string;
  compatibleBaseUrl: string;
  allowInvalidCertificates: boolean;
  closeToTray: boolean;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  dockerHost: "",
  compatibleBaseUrl: "",
  allowInvalidCertificates: false,
  closeToTray: true,
};

export function normalizeEngineSettings(input: {
  dockerHost?: string;
  compatibleBaseUrl?: string;
  allowInvalidCertificates?: boolean;
  closeToTray?: boolean;
}): EngineSettings {
  return {
    dockerHost: input.dockerHost?.trim() ?? DEFAULT_ENGINE_SETTINGS.dockerHost,
    compatibleBaseUrl:
      input.compatibleBaseUrl?.trim() ??
      DEFAULT_ENGINE_SETTINGS.compatibleBaseUrl,
    allowInvalidCertificates: Boolean(input.allowInvalidCertificates),
    closeToTray: input.closeToTray ?? DEFAULT_ENGINE_SETTINGS.closeToTray,
  };
}

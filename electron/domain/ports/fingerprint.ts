export interface ArtifactFingerprint {
  hash: string | null;
  size: number | null;
}

/** Hashes a file; directories are recorded without a hash. */
export type Fingerprint = (target: string) => Promise<ArtifactFingerprint>;

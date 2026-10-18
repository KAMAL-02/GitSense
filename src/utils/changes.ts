export interface TrackedChange {
  filepath: string;
  content: string;
  timestamp: number;
}

// Must stay at or under the backend's limits (gitsense-backend/src/config.ts)
export const LIMITS = {
  maxChanges: 100,
  maxCharsPerChange: 12_000,
  maxTotalChars: 190_000, // backend allows 200k; keep headroom for JSON overhead
};

const TRUNCATION_MARKER = "\n... (truncated)";

// Files that commonly hold credentials. These never leave the machine.
const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^\.(npmrc|pypirc|netrc|git-credentials|htpasswd)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /\.(pem|key|p12|pfx|jks|keystore|crt|cer|asc|gpg)$/i,
  /secret/i,
  /credential/i,
];

// Generated or vendored folders: noisy and not the user's own work
const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "out", "build", "coverage",
  ".next", ".nuxt", ".turbo", ".cache", "vendor", "__pycache__", ".venv", "venv", "target",
]);

export function isTrackablePath(relativePath: string): boolean {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  const fileName = parts.pop() ?? "";
  if (parts.some((dir) => IGNORED_DIRS.has(dir))) {
    return false;
  }
  return !SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

// Picks the newest changes and trims content so the request always passes backend validation
export function fitToLimits(changes: TrackedChange[]): TrackedChange[] {
  const newest = [...changes].sort((a, b) => b.timestamp - a.timestamp).slice(0, LIMITS.maxChanges);
  const perChange = Math.min(LIMITS.maxCharsPerChange, Math.floor(LIMITS.maxTotalChars / Math.max(newest.length, 1)));

  return newest
    .map((change) =>
      change.content.length <= perChange
        ? change
        : { ...change, content: change.content.slice(0, perChange - TRUNCATION_MARKER.length) + TRUNCATION_MARKER },
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

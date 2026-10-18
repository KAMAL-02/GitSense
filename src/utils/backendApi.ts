// Client for gitsense-backend. No vscode import, so it can be exercised from plain Node.
import type { TrackedChange } from "./changes";

export class BackendError extends Error {
  constructor(
    public readonly status: number, // 0 = never reached the server
    public readonly code: string,
  ) {
    super(code);
    this.name = "BackendError";
  }
}

export interface Usage {
  used: number;
  limit: number;
}

export interface SummaryResponse {
  summary: string;
  usage: Usage;
}

// Free hosting tiers cold-start in ~30s and Gemini can take a while, so be generous
const SUMMARY_TIMEOUT_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export class BackendApi {
  constructor(
    private readonly getBaseUrl: () => string,
    private readonly getToken: () => string | undefined,
  ) {}

  register(): Promise<unknown> {
    return this.request("POST", "/user/register");
  }

  updateLastCommit(lastCommitAt: number): Promise<unknown> {
    return this.request("PUT", "/user/update", { lastCommitAt });
  }

  summarize(changes: TrackedChange[]): Promise<SummaryResponse> {
    return this.request<SummaryResponse>("POST", "/summary", { changes }, SUMMARY_TIMEOUT_MS);
  }

  private async request<T>(method: string, path: string, body?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new BackendError(401, "not_signed_in");
    }

    let res: Response;
    try {
      res = await fetch(this.getBaseUrl() + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new BackendError(0, timedOut ? "timeout" : "network_error");
    }

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new BackendError(res.status, data.error ?? `http_${res.status}`);
    }
    return data as T;
  }
}

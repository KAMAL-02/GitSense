export class GithubError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

interface FileContent {
  content: string;
  sha: string;
}

const README = "# GitSense\nTracking my coding activity using VS Code extension";

export class GithubClient {
  constructor(
    private readonly token: string,
    private readonly repo: string,
  ) {}

  async getLogin(): Promise<string> {
    const user = await this.request<{ login: string }>("GET", "/user");
    return user.login;
  }

  // Creates the summaries repo and its README if they don't exist yet
  async ensureRepo(owner: string): Promise<void> {
    try {
      await this.request("GET", `/repos/${owner}/${this.repo}`);
    } catch (err) {
      if (!(err instanceof GithubError && err.status === 404)) {
        throw err; // network/auth problems must not be mistaken for "repo missing"
      }
      await this.request("POST", "/user/repos", {
        name: this.repo,
        private: false,
        description: "Repository for tracking code activity via GitSense extension",
      });
    }

    if (!(await this.getFile(owner, "README.md"))) {
      await this.putFile(owner, "README.md", README, "Initialize GitSense repository");
    }
  }

  // Appends a summary to summaries/YYYY/MM/DD.md (local date)
  async appendSummary(owner: string, summary: string, date = new Date()): Promise<void> {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const path = `summaries/${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}.md`;
    const time = date.toLocaleTimeString();

    // A concurrent push from another VS Code window makes the sha stale; re-read and retry once
    for (let attempt = 1; ; attempt++) {
      const existing = await this.getFile(owner, path);
      const content = existing
        ? `${existing.content}\n\n## ${time}\n${summary}`
        : `# Activity Summary for ${date.toLocaleDateString()}\n\n## ${time}\n${summary}`;
      try {
        await this.putFile(owner, path, content, `Add activity summary for ${time}`, existing?.sha);
        return;
      } catch (err) {
        const conflict = err instanceof GithubError && (err.status === 409 || err.status === 422);
        if (!conflict || attempt >= 2) {
          throw err;
        }
      }
    }
  }

  private async getFile(owner: string, path: string): Promise<FileContent | null> {
    try {
      const file = await this.request<{ content: string; sha: string }>("GET", this.contentsUrl(owner, path));
      return { content: Buffer.from(file.content, "base64").toString("utf8"), sha: file.sha };
    } catch (err) {
      if (err instanceof GithubError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  private async putFile(owner: string, path: string, content: string, message: string, sha?: string): Promise<void> {
    await this.request("PUT", this.contentsUrl(owner, path), {
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    });
  }

  private contentsUrl(owner: string, path: string): string {
    return `/repos/${owner}/${this.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      // 422s carry the real reason in errors[], e.g. "name already exists on this account"
      const data = (await res.json().catch(() => ({}))) as { message?: string; errors?: { message?: string; code?: string }[] };
      const details = (data.errors ?? []).map((e) => e.message ?? e.code).filter(Boolean).join("; ");
      const reason = [data.message, details].filter(Boolean).join(": ");
      throw new GithubError(res.status, `GitHub ${method} ${path.split("?")[0]} failed: ${res.status} ${reason}`.trim());
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
}

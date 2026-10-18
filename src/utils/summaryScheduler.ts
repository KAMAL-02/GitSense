import * as vscode from "vscode";
import { ActivityTracker } from "./activityTracker";
import { BackendApi, BackendError } from "./backendApi";
import { fitToLimits } from "./changes";
import { SUMMARY_INTERVAL_MS } from "./config";
import { GithubClient } from "./githubApi";
import { log } from "./logger";

export interface GithubAccount {
  client: GithubClient;
  username: string;
}

export type RunOutcome =
  | { kind: "pushed"; at: Date; files: number }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; message: string };

const FRIENDLY_ERRORS: Record<string, string> = {
  daily_quota_exceeded: "Daily summary limit reached. GitSense will try again tomorrow.",
  rate_limited: "Too many requests. GitSense will try again later.",
  network_error: "Couldn't reach the GitSense server. Will retry next hour.",
  timeout: "The GitSense server took too long to respond. Will retry next hour.",
  invalid_token: "GitHub session was rejected. Run 'GitSense: Sign in with GitHub'.",
  not_signed_in: "Not signed in to GitHub. Run 'GitSense: Sign in with GitHub'.",
  ai_unavailable: "The summary service is temporarily unavailable. Will retry next hour.",
  ai_timeout: "The summary service timed out. Will retry next hour.",
  empty_summary: "No summary could be generated for these changes. Will retry next hour.",
};

export class SummaryScheduler implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private readonly outcomeEmitter = new vscode.EventEmitter<RunOutcome>();

  readonly onDidRun = this.outcomeEmitter.event;

  constructor(
    private readonly tracker: ActivityTracker,
    private readonly api: BackendApi,
    private readonly getAccount: () => GithubAccount | undefined,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => void this.run(), SUMMARY_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async run(): Promise<RunOutcome> {
    const outcome = await this.runOnce();
    if (outcome.kind === "failed") {
      log.warn(`Summary run failed: ${outcome.message}`);
    } else if (outcome.kind === "skipped") {
      log.info(`Summary run skipped: ${outcome.reason}`);
    }
    this.outcomeEmitter.fire(outcome);
    return outcome;
  }

  private async runOnce(): Promise<RunOutcome> {
    if (this.running) {
      return { kind: "skipped", reason: "a summary is already being generated" };
    }
    if (!this.tracker.hasChanges()) {
      return { kind: "skipped", reason: "no saved changes since the last summary" };
    }
    const account = this.getAccount();
    if (!account) {
      return { kind: "failed", message: FRIENDLY_ERRORS.not_signed_in };
    }

    this.running = true;
    try {
      const batch = fitToLimits(this.tracker.snapshot());
      log.info(`Generating summary for ${batch.length} file(s)`);
      const { summary, usage } = await this.api.summarize(batch);

      await account.client.appendSummary(account.username, summary);
      this.tracker.acknowledge(batch);
      log.info(`Pushed summary to ${account.username}'s repo (${usage.used}/${usage.limit} today)`);

      // Bookkeeping only; a failure here must not undo a successful push
      this.api.updateLastCommit(Date.now()).catch((err) => log.warn(`Couldn't update last commit time: ${describe(err)}`));

      return { kind: "pushed", at: new Date(), files: batch.length };
    } catch (err) {
      // Changes stay pending, so the next run retries them
      return { kind: "failed", message: describe(err) };
    } finally {
      this.running = false;
    }
  }

  dispose(): void {
    this.stop();
    this.outcomeEmitter.dispose();
  }
}

function describe(err: unknown): string {
  if (err instanceof BackendError) {
    return FRIENDLY_ERRORS[err.code] ?? `GitSense server error (${err.status} ${err.code}).`;
  }
  return err instanceof Error ? err.message : String(err);
}

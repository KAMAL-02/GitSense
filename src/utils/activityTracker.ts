import * as vscode from "vscode";
import { isTrackablePath, TrackedChange } from "./changes";

// Upper bound on files remembered between summaries, to keep memory in check
const MAX_TRACKED_FILES = 500;

export class ActivityTracker implements vscode.Disposable {
  // Latest snapshot per file (workspace-relative path) since the last successful summary
  private readonly changes = new Map<string, TrackedChange>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly saveListener: vscode.Disposable;

  readonly onDidChange = this.changeEmitter.event;

  constructor() {
    this.saveListener = vscode.workspace.onDidSaveTextDocument((doc) => this.track(doc));
  }

  get pendingCount(): number {
    return this.changes.size;
  }

  hasChanges(): boolean {
    return this.changes.size > 0;
  }

  snapshot(): TrackedChange[] {
    return [...this.changes.values()];
  }

  // Forget only what was actually summarized. Files saved again while the request was in
  // flight have a newer timestamp and stay pending for the next run.
  acknowledge(sent: TrackedChange[]): void {
    for (const change of sent) {
      if (this.changes.get(change.filepath)?.timestamp === change.timestamp) {
        this.changes.delete(change.filepath);
      }
    }
    this.changeEmitter.fire();
  }

  private track(doc: vscode.TextDocument): void {
    // Only real files inside an open workspace folder. This skips untitled buffers, git/diff
    // views, and files like the user's settings.json that live outside the project.
    if (doc.uri.scheme !== "file" || !vscode.workspace.getWorkspaceFolder(doc.uri)) {
      return;
    }
    const filepath = vscode.workspace.asRelativePath(doc.uri, true);
    if (!isTrackablePath(filepath)) {
      return;
    }

    // Re-insert so Map order stays oldest-first for eviction
    this.changes.delete(filepath);
    this.changes.set(filepath, { filepath, content: doc.getText(), timestamp: Date.now() });
    if (this.changes.size > MAX_TRACKED_FILES) {
      this.changes.delete(this.changes.keys().next().value!);
    }
    this.changeEmitter.fire();
  }

  dispose(): void {
    this.saveListener.dispose();
    this.changeEmitter.dispose();
  }
}

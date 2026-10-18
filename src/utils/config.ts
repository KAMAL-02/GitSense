import * as vscode from "vscode";

export const DEFAULT_API_URL = "https://gitsense-backend.vercel.app";

export const REPO_NAME = "GitSense-Commits";
export const SUMMARY_INTERVAL_MS = 60 * 60 * 1000;

export const GITHUB_SCOPES = ["repo"];

export function getApiUrl(): string {
  const configured = vscode.workspace.getConfiguration("gitsense").get<string>("apiUrl")?.trim();
  return (configured || DEFAULT_API_URL).replace(/\/+$/, "");
}

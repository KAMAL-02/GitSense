import * as vscode from "vscode";
import { ActivityTracker } from "./utils/activityTracker";
import { BackendApi } from "./utils/backendApi";
import { getApiUrl, GITHUB_SCOPES, REPO_NAME } from "./utils/config";
import { GithubClient } from "./utils/githubApi";
import { log } from "./utils/logger";
import { GithubAccount, RunOutcome, SummaryScheduler } from "./utils/summaryScheduler";

let token: string | undefined;
let account: GithubAccount | undefined;
let lastOutcome: RunOutcome | undefined;
let statusItem: vscode.StatusBarItem;
let tracker: ActivityTracker;
let api: BackendApi;

export async function activate(context: vscode.ExtensionContext) {
	log.info(`GitSense activated (backend: ${getApiUrl()})`);

	api = new BackendApi(getApiUrl, () => token);
	tracker = new ActivityTracker();
	const scheduler = new SummaryScheduler(tracker, api, () => account);

	statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusItem.show();

	context.subscriptions.push(
		log,
		tracker,
		scheduler,
		statusItem,
		tracker.onDidChange(updateStatus),
		scheduler.onDidRun((outcome) => {
			lastOutcome = outcome;
			updateStatus();
		}),

		vscode.commands.registerCommand("gitsense.summarizeNow", async () => {
			if (!account && !(await connect("interactive"))) {
				return;
			}
			const outcome = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: "GitSense: Generating and pushing summary..." },
				() => scheduler.run(),
			);
			if (outcome.kind === "pushed") {
				vscode.window.showInformationMessage(`GitSense: Pushed a summary of ${outcome.files} file(s) to ${account?.username}/${REPO_NAME}.`);
			} else if (outcome.kind === "skipped") {
				vscode.window.showInformationMessage(`GitSense: Nothing to do, ${outcome.reason}.`);
			} else {
				vscode.window.showErrorMessage(`GitSense: ${outcome.message}`);
			}
		}),
		vscode.commands.registerCommand("gitsense.signIn", () => connect("interactive")),
		vscode.commands.registerCommand("gitsense.showLog", () => log.show()),

		vscode.authentication.onDidChangeSessions((e) => {
			if (e.provider.id === "github") {
				void connect("silent");
			}
		}),
	);

	updateStatus();
	scheduler.start();
	void connect("prompt");
}

export function deactivate() {}

type ConnectMode = "silent" | "prompt" | "interactive";

// VS Code fires several session-change events at once on sign-in. Run connects one at a
// time so they don't each set up the repo (and each show an error) in parallel.
let connectQueue: Promise<boolean> = Promise.resolve(false);
let failedToken: string | undefined;

/**
 * silent:      use an existing session only (auth changes, background)
 * prompt:      if there's no session, show a non-modal "Sign in" notification (startup)
 * interactive: open GitHub sign-in right away (commands)
 */
function connect(mode: ConnectMode): Promise<boolean> {
	connectQueue = connectQueue.then(() => doConnect(mode), () => doConnect(mode));
	return connectQueue;
}

async function doConnect(mode: ConnectMode): Promise<boolean> {
	let session: vscode.AuthenticationSession | undefined;
	try {
		session = await vscode.authentication.getSession(
			"github",
			GITHUB_SCOPES,
			mode === "interactive" ? { createIfNone: true } : { silent: true },
		);
	} catch {
		log.info("GitHub sign-in was cancelled");
	}

	if (!session) {
		token = undefined;
		account = undefined;
		updateStatus();
		if (mode === "prompt") {
			void vscode.window
				.showInformationMessage("GitSense needs access to your GitHub account to push activity summaries.", "Sign in")
				.then((choice) => choice && connect("interactive"));
		}
		return false;
	}

	if (session.accessToken === token && account) {
		return true; // nothing changed
	}
	// Setup already failed for this exact session; only retry when the user explicitly asks
	if (session.accessToken === failedToken && mode !== "interactive") {
		return false;
	}

	token = session.accessToken;
	try {
		const client = new GithubClient(token, REPO_NAME);
		const username = await client.getLogin();
		await client.ensureRepo(username);
		account = { client, username };
		failedToken = undefined;
		log.info(`Connected as ${username}`);
		if (mode === "interactive") {
			vscode.window.showInformationMessage(`GitSense: Connected to GitHub as ${username}.`);
		}
	} catch (err) {
		account = undefined;
		failedToken = session.accessToken;
		log.error(`Couldn't set up GitHub: ${err instanceof Error ? err.message : String(err)}`);
		vscode.window.showErrorMessage("GitSense: Couldn't set up your GitHub repository. See 'GitSense: Show Log' for details.");
		updateStatus();
		return false;
	}

	// Not required for summaries (the backend registers users on any request), so don't block on it
	api.register().catch((err) => log.warn(`Backend registration failed: ${err instanceof Error ? err.message : String(err)}`));
	updateStatus();
	return true;
}

function updateStatus() {
	if (!account) {
		statusItem.text = "$(github) GitSense: Sign in";
		statusItem.tooltip = "Sign in with GitHub to start pushing activity summaries";
		statusItem.command = "gitsense.signIn";
		return;
	}

	const pending = tracker.pendingCount;
	const failed = lastOutcome?.kind === "failed";
	statusItem.text = `${failed ? "$(warning)" : "$(git-commit)"} GitSense${pending ? ` (${pending})` : ""}`;
	statusItem.command = "gitsense.summarizeNow";

	const lines = [
		`Signed in as ${account.username}`,
		`${pending} file(s) waiting for the next summary`,
	];
	if (lastOutcome?.kind === "pushed") {
		lines.push(`Last summary pushed at ${lastOutcome.at.toLocaleTimeString()}`);
	} else if (lastOutcome?.kind === "failed") {
		lines.push(`Last run failed: ${lastOutcome.message}`);
	}
	lines.push("", "Click to summarize and push now");
	statusItem.tooltip = lines.join("\n");
}

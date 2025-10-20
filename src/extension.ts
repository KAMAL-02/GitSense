import * as vscode from 'vscode';
import { pushSummary } from './utils/summaryGeneration';
import { GithubService } from './utils/githubApi';
import { initializeGithubService } from './utils/githubApi';
import { tracker } from './utils/activityTracker';
import { loadConfig, Config } from './utils/loadenv';

let githubService: GithubService;

export let globalConfig: Config;

// Export function to access githubService from other modules
export function getGithubService(): GithubService | undefined {
	return githubService;
}

export async function activate(context: vscode.ExtensionContext) {

	console.log('your extension "GitSense" is now active!');

	globalConfig = loadConfig(context);
	console.log("globalConfig:", globalConfig);

	if (!globalConfig.aiKey || !globalConfig.prompt || !globalConfig.apiUrl) {
		throw new Error("GitSense: Required configuration not found (aiKey, prompt, or apiUrl)");
	}

	githubService = initializeGithubService(context);
    await githubService.checkSession();
	pushSummary(githubService);

	const authSessionChange = vscode.authentication.onDidChangeSessions(async (e) => {
		if (e.provider.id !== 'github') {
			return;
		}
		console.log('GitSense: GitHub auth session changed, re-initializing...');
		try {
			await githubService.checkSession();
			pushSummary(githubService);
		} catch (err) {
			console.error('GitSense: Error re-initializing after auth change', err);
		}
	});

	context.subscriptions.push(authSessionChange);
}

export function deactivate() {
	tracker.dispose();
}

// import * as vscode from 'vscode';
// import { Octokit } from '@octokit/rest';

// export class GitHubService {
//     private octokit: Octokit;
//     private readonly repoName = 'gitime';
//     private timer: NodeJS.Timer | null = null;

//     constructor() {
//         // Initialize without token first
//         this.octokit = new Octokit();
//     }

//     // Setup method to be called when extension activates
//     async setup() {
//         const token = await this.getOrRequestToken();
//         this.octokit = new Octokit({ auth: token });
//         await this.ensureRepositoryExists();
//         this.startAutoCommits();
//     }

//     private async getOrRequestToken(): Promise<string> {
//         // First check if token exists in settings
//         const config = vscode.workspace.getConfiguration('gitime');
//         let token = config.get<string>('githubToken');

//         if (!token) {
//             // If no token, prompt user
//             token = await vscode.window.showInputBox({
//                 prompt: 'Please enter your GitHub Personal Access Token (needs repo access)',
//                 password: true, // Hides the input
//                 ignoreFocusOut: true, // Keeps prompt open when focus is lost
//                 placeHolder: 'ghp_xxx...',
//                 validateInput: (input) => {
//                     return input.startsWith('ghp_') ? null : 'Token should start with ghp_';
//                 }
//             });

//             if (!token) {
//                 throw new Error('GitHub token is required for this extension to work');
//             }

//             // Save token in VSCode settings
//             await config.update('githubToken', token, true);
//         }

//         return token;
//     }

//     private async ensureRepositoryExists() {
//         try {
//             const { data: user } = await this.octokit.users.getAuthenticated();
            
//             try {
//                 // Check if repo exists
//                 await this.octokit.repos.get({
//                     owner: user.login,
//                     repo: this.repoName
//                 });
//                 console.log('Repository already exists');
//             } catch {
//                 // Create new repository if it doesn't exist
//                 await this.octokit.repos.createForAuthenticatedUser({
//                     name: this.repoName,
//                     private: true,
//                     description: 'Automated code activity tracking and summaries',
//                     auto_init: true // Creates with a README
//                 });
//                 console.log('Created new repository: gitime');
//                 vscode.window.showInformationMessage('Created new gitime repository in your GitHub account');
//             }
//         } catch (error) {
//             vscode.window.showErrorMessage(`Failed to setup GitHub repository: ${error.message}`);
//             throw error;
//         }
//     }

//     async commitSummary(summary: string) {
//         try {
//             const { data: user } = await this.octokit.users.getAuthenticated();
//             const date = new Date().toISOString();
//             const fileName = `summaries/${date.split('T')[0]}/${date.split('T')[1].split('.')[0].replace(/:/g, '-')}.md`;

//             // Get the default branch
//             const { data: repo } = await this.octokit.repos.get({
//                 owner: user.login,
//                 repo: this.repoName
//             });

//             try {
//                 // Create or update the file
//                 await this.octokit.repos.createOrUpdateFileContents({
//                     owner: user.login,
//                     repo: this.repoName,
//                     path: fileName,
//                     message: `Update coding activity summary for ${date}`,
//                     content: Buffer.from(summary).toString('base64'),
//                     branch: repo.default_branch
//                 });

//                 console.log('Successfully committed summary');
//             } catch (error) {
//                 console.error('Error committing summary:', error);
//                 throw error;
//             }
//         } catch (error) {
//             vscode.window.showErrorMessage(`Failed to commit summary: ${error.message}`);
//             throw error;
//         }
//     }

//     private startAutoCommits() {
//         // Clear any existing timer
//         if (this.timer) {
//             clearInterval(this.timer);
//         }

//         // Set up hourly commits
//         this.timer = setInterval(async () => {
//             try {
//                 // This will be called from your main extension file
//                 vscode.commands.executeCommand('gitime.createHourlySummary');
//             } catch (error) {
//                 console.error('Error in auto-commit:', error);
//             }
//         }, 60 * 60 * 1000); // Run every hour
//     }

//     // Cleanup method to be called when extension deactivates
//     dispose() {
//         if (this.timer) {
//             clearInterval(this.timer);
//         }
//     }
// }
import * as vscode from "vscode";
const { Octokit } = require("@octokit/rest");
export class GithubService {
  public Info: {
    token: string | undefined;
    username: string | undefined;
    octokit: any;
    git: any;
  };

  constructor() {
    this.Info = {
      token: undefined,
      username: undefined,
      octokit: undefined,
      git: undefined,
    };
  }

  public async getToken() {

    const token = await vscode.window.showInputBox({
      prompt:
        "Enter your github personal access token (PAT) with access to repo",
      placeHolder: "ghp_xxx...",
      ignoreFocusOut: true,
      password: true,
    });
    if (!token) {
      return vscode.window.showWarningMessage("PAR is required for autocommit");
    }

    this.Info.token = token;
    this.Info.octokit = new Octokit({ auth: token });

    try {
      const { data } = await this.Info.octokit.users.getAuthenticated();
      this.Info.username = data.login;
      if (!this.Info.username) {
        return vscode.window.showErrorMessage(
          "Error setting Github, Kindly check you PAT"
        );
      }
      console.log("Username is:", this.Info.username);
      this.createRepo();
    } catch (error) {
      console.log("Error setting username", error);
      return vscode.window.showErrorMessage(
        "Error setting Github, Kindly check you PAT"
      );
    }
  }

  public async createRepo() {
    if (!this.Info.octokit || !this.Info.username) {
      return vscode.window.showErrorMessage(
        "Error setting Github, Kindly check you PAT"
      );
    }
    try {
      await this.Info.octokit.repos.get({
        owner: this.Info.username,
        repo: "AutoGitime",
      });
      console.log("Repository already exists");
      await this.initializeRepo();
    } catch (error) {
      await this.Info.octokit.repos.createForAuthenticatedUser({
        name: "AutoGitime",
        private: false,
        description:
          "Repository for tracking code activity via Gitime extension",
      });
      console.log("Created new repository: AutoGitime");
      this.initializeRepo();
    }
  }
  public async initializeRepo() {
    if(!this.Info.octokit || !this.Info.username){
      return vscode.window.showErrorMessage("Error setting Github, Kindly check you PAT");
    }

    try {
      try {
        await this.Info.octokit.repos.getContent({
          owner: this.Info.username!,
          repo: "AutoGitime",
          path: "README.md"
        });
      } catch (error) {
        await this.Info.octokit.repos.createOrUpdateFileContents({
          owner: this.Info.username!,
          repo: "AutoGitime",
          path: "README.md",
          message: "Initialize gitime repository",
          content: Buffer.from("# Gitime\nTracking my coding activity using VS Code extension").toString("base64")
        });
      }
    } catch (error) {
      console.error("Error initializing repository:", error);
      vscode.window.showErrorMessage("Failed to initialize repository");
    }
  }

  public async saveSummary(summary: string) {
    if (!this.Info.octokit || !this.Info.username) {
      vscode.window.showErrorMessage("GitHub service not initialized");
      return;
    }
    try {
      const date = new Date();
      const fileName = `summaries/${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}.md`;
      
      // Try to get existing content
      let currentContent = '';
      let fileSha;
      
      try {
        const response = await this.Info.octokit.repos.getContent({
          owner: this.Info.username,
          repo: "AutoGitime",
          path: fileName
        });
        
        if ('content' in response.data) {
          currentContent = Buffer.from(response.data.content, 'base64').toString();
          fileSha = response.data.sha;
        }
      } catch {
        // File doesn't exist yet, that's okay
      }

      // Format new content
      const timeString = date.toLocaleTimeString();
      const newContent = currentContent ? 
        `${currentContent}\n\n## ${timeString}\n${summary}` :
        `# Activity Summary for ${date.toLocaleDateString()}\n\n## ${timeString}\n${summary}`;

      // Create or update file
      await this.Info.octokit.repos.createOrUpdateFileContents({
        owner: this.Info.username,
        repo: "AutoGitime",
        path: fileName,
        message: `Add activity summary for ${timeString}`,
        content: Buffer.from(newContent).toString('base64'),
        ...(fileSha ? { sha: fileSha } : {})
      });

      vscode.window.showInformationMessage('Successfully saved activity summary');
    } catch (error) {
      console.error("Failed to save summary:", error);
      vscode.window.showErrorMessage("Failed to save activity summary");
    }
  }
}

export function initializeGithubService() {
  const githubService = new GithubService();
  return githubService;
}

export const githubService = initializeGithubService();



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
//             vscode.window.showErrorMessage(`Failed toGitime summary: ${error.message}`);
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

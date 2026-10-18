# GitSense - Automate Your GitHub Contributions

GitSense is a VS Code extension that automates the process of summarizing your coding activity and committing it to a GitHub repository. It monitors your coding activity in one-hour intervals, generates a summary of your changes, and commits and pushes these summaries to your GitHub repository named `GitSense-commits`. This tool streamlines tracking your progress and maintaining a log of your work.

---

## Why GitSense?

In many professional workflows, developers often work on feature branches and make commits. However, when these branches are merged, the commit history becomes condensed, and the individual contributions are not reflected. Additionally, many developers use separate email accounts for professional work, leaving little time to enhance their personal GitHub profiles.

GitSense addresses this gap by ensuring your personal GitHub profile stays active and well-maintained. It automatically updates your GitHub commit chart with regular commits, helping you showcase consistent activity and growth as a developer.

---

## Features

1. **Automated Monitoring**: GitSense monitors the codes you save and generates summaries of your code every hour.
2. **Hourly Commits**: After continous hour of work, GitSense commits and pushes a summary of your changes to the `GitSense-commits` repository.
   - For example, if you work for 2 hours continously, there will be 2 commits and pushes.
3. **GitHub Integration**: Seamlessly integrates with VS Code's GitHub authentication to access your account.
4. **Enhance Your GitHub Profile**: Maintain a consistent and active commit chart on your personal GitHub profile, even when working on professional projects.

---

## Installation

Install GitSense from the VS Code marketplace. [Link to the extension](https://marketplace.visualstudio.com/items?itemName=KAMAL-02.gitsense).

---

## Getting Started

### Authenticate with GitHub
GitSense requires access to your GitHub account to push commits. 

1. If you are already logged into VS Code through GitHub, GitSense will start working immediately.
2. If not, you will be prompted to login via GitHub when you first use the extension.
3. Once authenticated, GitSense will automatically monitor your coding activity and commit summaries to your `GitSense-commits` repository.

---

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and type **GitSense**:

- **Summarize and Push Now**: push a summary immediately instead of waiting for the hourly run
- **Sign in with GitHub**: connect or reconnect your GitHub account
- **Show Log**: open the GitSense output log for troubleshooting

The **GitSense** item in the status bar shows how many files are waiting for the next summary. Click it to push now.

---

## Privacy

- When you save a file in your workspace, GitSense keeps its latest contents in memory until the next hourly summary.
- To generate the summary, those contents are sent to the GitSense server, which passes them to Google Gemini. Code is **not stored** on the server; only your GitHub username, profile info and usage counts are.
- Files that commonly contain secrets are **never sent**: `.env` files, private keys and certificates, `.npmrc`/`.netrc`, and any file with "secret" or "credential" in its name. Files in `node_modules`, `.git`, `dist`, `build` and similar folders, and files outside your open workspace, are skipped too.
- GitSense uses `repo` access to write to your `GitSense-Commits` repository. The repository is created as public, but you can make it private on GitHub and GitSense keeps working.

---

## Requirements
- **VS Code**: Make sure you have VS Code installed.
- **GitHub Account**: Required for authentication via VS Code.

---

## About the Creator
GitSense is created and maintained by **KAMAL-02**. Feel free to reach out.

---

## License
GitSense is licensed under the MIT License. See the `LICENSE` file for details.


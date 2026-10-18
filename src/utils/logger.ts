import * as vscode from "vscode";

// Shows up under Output > GitSense. Never log tokens or file contents here.
export const log = vscode.window.createOutputChannel("GitSense", { log: true });

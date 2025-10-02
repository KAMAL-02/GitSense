import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Config {
    aiKey: string;
    prompt: string;
}

export function loadConfig(context: vscode.ExtensionContext): Config {
    console.log("Inside loadenv");
    const config = vscode.workspace.getConfiguration('gitsense');
    const settingsConfig = {
        aiKey: config.get<string>('aiKey') || '',
        prompt: config.get<string>('prompt') || ''
    };

    if (settingsConfig.aiKey && settingsConfig.prompt) {
        return settingsConfig;
    }

    // Fallback to .env
    const envPath = path.join(context.extensionPath, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const aiKey = envContent.match(/AI_KEY=(.+)/)?.[1] || '';
        const prompt = envContent.match(/PROMPT=(.*)/s)?.[1] || '';
        return { aiKey, prompt };
    }

    return settingsConfig;
}
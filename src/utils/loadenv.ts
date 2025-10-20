import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Config {
    aiKey: string;
    prompt: string;
    apiUrl?: string;
}

export function loadConfig(context: vscode.ExtensionContext): Config {
    console.log("Inside loadenv");
    const config = vscode.workspace.getConfiguration('gitsense');
    const settingsConfig = {
        aiKey: config.get<string>('aiKey') || '',
        prompt: config.get<string>('prompt') || '',
        apiUrl: config.get<string>('apiUrl') || '',
    };

    if (settingsConfig.aiKey && settingsConfig.prompt && settingsConfig.apiUrl) {
        return settingsConfig;
    }

    // Fallback to .env
    const envPath = path.join(context.extensionPath, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        const aiKey = envContent.match(/^AI_KEY=(.+)/m)?.[1]?.trim() || '';
        const prompt = envContent.match(/^PROMPT=(.*?)(?=\n|$)/ms)?.[1]?.trim() || '';
        const apiUrl = envContent.match(/^API_URL=(.+)/m)?.[1]?.trim() || '';

        return { aiKey, prompt, apiUrl };
    }

    return settingsConfig;
}
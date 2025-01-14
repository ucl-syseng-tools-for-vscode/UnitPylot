"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSidebarViewProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
class ChatSidebarViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "src")],
        };
        const htmlPath = path.join(this._extensionUri.fsPath, "src", "chat.html");
        const htmlContent = fs.readFileSync(htmlPath, "utf8");
        webviewView.webview.html = htmlContent;
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "sendMessage") {
                const response = await this.fetchChatResponse(message.message);
                this._view?.webview.postMessage({ command: "botResponse", response });
            }
        });
    }
    async fetchChatResponse(userMessage) {
        try {
            const response = await fetch('http://localhost:8000/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "microsoft/Phi-3.5-mini-instruct",
                    messages: [
                        {
                            role: "user",
                            content: userMessage
                        }
                    ]
                }),
            });
            const data = await response.json();
            return data.choices[0].message.content || 'No response from the server.';
        }
        catch (error) {
            console.error('Error fetching chat response:', error);
            return 'Error: Could not fetch response.';
        }
    }
}
exports.ChatSidebarViewProvider = ChatSidebarViewProvider;
ChatSidebarViewProvider.viewType = "dashboard.chatview";
//# sourceMappingURL=ChatSideBarProvider.js.map
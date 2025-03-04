import * as vscode from "vscode";
import { Settings } from "../settings/settings";
import { LlmMessage } from "./llm-message";
import { format } from "path";

export class Llm {
    /**
     * Send a request to the LLM service
     * @param messages The messages to send
     * @returns The response from the LLM service
     */
    public static async sendRequest(messages: LlmMessage[], json?: boolean): Promise<vscode.LanguageModelChatResponse> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Processing request",
            cancellable: false
        }, async (progress, token) => {
            let output;

            progress.report({ message: "Initialising..." });

            if (Settings.COPILOT_ENABLED) {
                progress.report({ message: "Sending request to Copilot..." });
                output = await this.sendRequestToCopilot(messages);
            } else {
                progress.report({ message: "Sending request to Custom LLM..." });
                output = await this.sendRequestToCustomLlm(messages, json);
            }

            progress.report({ message: "Processing complete!" });

            return output; // Return the result after progress completes
        });
    }

    private static async sendRequestToCopilot(messages: LlmMessage[]): Promise<vscode.LanguageModelChatResponse> {
        let [model] = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o',
        });

        if (model) {
            const chatResponse = await model.sendRequest(
                messages.map(m => vscode.LanguageModelChatMessage.User(m.content)),
                {},
                new vscode.CancellationTokenSource().token
            );

            return chatResponse;
        }
        return Promise.reject('No model found');
    }

    private static async sendRequestToCustomLlm(messages: LlmMessage[], json: boolean = false): Promise<vscode.LanguageModelChatResponse> {
        const endpoint = Settings.CUSTOM_LLM_ENDPOINT;
        const apiKey = Settings.CUSTOM_LLM_API_KEY;
        const model = Settings.CUSTOM_LLM_MODEL;

        if (!endpoint) {
            vscode.window.showErrorMessage("No custom LLM endpoint configured");
            return Promise.reject("No custom LLM endpoint configured");
        }
        else if (!model) {
            vscode.window.showErrorMessage("No custom LLM model configured");
            return Promise.reject("No custom LLM model configured");
        }

        let formattedMessages = messages.map(m => ({
            role: m.role || "user", // Default to "user" if no role is set
            content: m.content,
        }));

        if (json) {
            formattedMessages.push({
                role: "system",
                content: "IMP: Ensure the output is JSON formatted. Make sure the output follows the format specified in the previous messages.",
            });
        }

        const requestBody = {
            model: model,
            messages: formattedMessages,
            temperature: 0.7,
            max_tokens: Settings.CUSTOM_LLM_MAX_TOKENS,
            top_p: 1.0,
            format: json ? "json" : null,
        };

        let headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            // Construct the full response object and then convert to steam to ensure compatibility
            const data = await response.json();
            const finishReason = data.choices[0].finish_reason;
            if (finishReason === 'length') {
                vscode.window.showWarningMessage('LLM response was truncated. Increase the max_tokens parameter!');
            }
            var dataStr: string = data.choices[0].message.content;
            const dataStrFormatted = this.formatOutput(dataStr);

            console.info('LLM Output: ' + dataStrFormatted);


            const responseStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(dataStrFormatted));
                    controller.close();
                }
            });

            // Convert stream to async iterable
            const reader = responseStream.getReader();
            return {
                text: this.processStream(reader), // Attach async generator
            } as unknown as vscode.LanguageModelChatResponse;

        } catch (error) {
            vscode.window.showErrorMessage(`Error fetching LLM response: ${error}`);
            return Promise.reject(`Error fetching LLM response: ${error}`);
        }
    }

    // Async generator to convert stream into an async iterable
    private static async *processStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            accumulatedText += decoder.decode(value, { stream: true });

            // Stream out fragments
            yield accumulatedText;
        }
    }

    // Format the LLM output
    private static formatOutput(dataStr: string): string {
        // If data contains ``` then only use the content between the code blocks
        if (dataStr.includes('```')) {
            let start = dataStr.indexOf('```');
            let end = dataStr.lastIndexOf('```');
            end = end === start ? dataStr.length : end;
            dataStr = dataStr.slice(start + 3, end);
        }

        // If it is contained in a list, then remove the outer brackets (helper-func expects a list of objects with no outer brackets)
        let containsList = false;
        let start = 0;
        for (let i = 0; i < dataStr.length; i++) {
            let a = dataStr[i];
            if (dataStr[i] === '[') {
                containsList = true;
            }
            else if (dataStr[i] === '{') {
                start = i;
                break;
            }
        }
        let end = dataStr.length - 1;
        if (containsList) {
            for (let i = dataStr.length - 1; i >= 0; i--) {
                if (dataStr[i] === '}') {
                    end = i;
                }
            }
        }

        return dataStr.slice(start, end + 1);
    }
}
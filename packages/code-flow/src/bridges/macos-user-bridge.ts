import { execSync } from 'node:child_process';
import type { Answer, Question, UserBridge, UserBridgeConfig } from '../interfaces/index.js';

/**
 * Configuration for MacosUserBridge
 */
export interface MacosUserBridgeConfig extends UserBridgeConfig {
    // No additional configuration needed - osascript works out of the box on macOS
}

/**
 * MacosUserBridge manages Q&A through native macOS AppleScript dialogs
 * Questions are displayed as blocking dialogs that wait for user input
 */
export class MacosUserBridge implements UserBridge {
    private currentQuestion: string = '';

    async ask(question: Question, config: UserBridgeConfig): Promise<void> {
        // Store the question for use in waitForAnswer
        this.currentQuestion = question.question;
    }

    async waitForAnswer(config: UserBridgeConfig): Promise<Answer> {
        if (!this.currentQuestion) {
            throw new Error('No question has been asked yet. Call ask() first.');
        }

        // Escape special characters for AppleScript
        const escapedQuestion = this.escapeAppleScriptString(this.currentQuestion);

        // Build the AppleScript command to show a dialog with a text input
        const script = `display dialog "${escapedQuestion}" default answer "" buttons {"Cancel", "OK"} default button "OK"`;

        try {
            // Execute the AppleScript command synchronously (blocks until user responds)
            const result = execSync(`osascript -e '${script}'`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            // Parse the result
            // AppleScript returns: "button returned:OK, text returned:user's answer"
            const answer = this.parseAppleScriptResult(result);

            // Clear the current question
            this.currentQuestion = '';

            return { answer };
        } catch (error) {
            // User clicked Cancel or command failed
            if (error instanceof Error) {
                // Check if user canceled
                if (error.message.includes('User canceled')) {
                    throw new Error('User canceled the dialog');
                }
                // Check if osascript is not available (non-macOS)
                if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
                    throw new Error('osascript is not available. MacosUserBridge only works on macOS.');
                }
                throw new Error(`Failed to get answer: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Escapes special characters in strings for AppleScript
     */
    private escapeAppleScriptString(str: string): string {
        return str
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/"/g, '\\"')    // Escape double quotes
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r')   // Escape carriage returns
            .replace(/\t/g, '\\t');  // Escape tabs
    }

    /**
     * Parses the AppleScript result to extract the user's answer
     * AppleScript returns: "button returned:OK, text returned:user's answer"
     */
    private parseAppleScriptResult(result: string): string {
        // Use dotall flag (s) to match across newlines
        const match = result.match(/text returned:(.*)$/s);
        if (match && match[1] !== undefined) {
            return match[1].trim();
        }
        throw new Error('Failed to parse AppleScript result');
    }
}

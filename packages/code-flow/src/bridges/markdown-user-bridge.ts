import { readFile, writeFile, stat } from 'node:fs/promises';
import type { Answer, Question, UserBridge, UserBridgeConfig } from '../interfaces/index.js';

/**
 * Configuration for MarkdownUserBridge
 */
export interface MarkdownUserBridgeConfig extends UserBridgeConfig {
    /** Path to the markdown file to use for Q&A */
    filePath: string;
    /** Polling interval in milliseconds (default: 60000ms / 60s) */
    pollInterval?: number;
}

/**
 * MarkdownUserBridge manages Q&A through markdown file sections
 * Questions are written under ## Q&A as ### [question]
 * Answers are written as content under the question heading
 */
export class MarkdownUserBridge implements UserBridge {
    private lastModifiedTime: number = 0;
    private currentQuestion: string = '';

    async ask(question: Question, config: UserBridgeConfig): Promise<void> {
        const mdConfig = config as MarkdownUserBridgeConfig;

        if (!mdConfig.filePath) {
            throw new Error('MarkdownUserBridge requires a filePath configuration');
        }

        this.currentQuestion = question.question;

        // Read existing content
        let content: string;
        try {
            content = await readFile(mdConfig.filePath, 'utf-8');
        } catch {
            // File doesn't exist, create new content
            content = '';
        }

        // Add Q&A section if it doesn't exist
        if (!content.includes('## Q&A')) {
            content += '\n\n## Q&A\n';
        }

        // Add the question
        const questionSection = `\n### ${question.question}\n\n_Awaiting answer..._\n`;
        content += questionSection;

        await writeFile(mdConfig.filePath, content, 'utf-8');

        // Update last modified time
        const stats = await stat(mdConfig.filePath);
        this.lastModifiedTime = stats.mtimeMs;
    }

    async waitForAnswer(config: UserBridgeConfig): Promise<Answer> {
        const mdConfig = config as MarkdownUserBridgeConfig;
        const pollInterval = mdConfig.pollInterval ?? 60000; // Default 60 seconds

        if (!mdConfig.filePath) {
            throw new Error('MarkdownUserBridge requires a filePath configuration');
        }

        // Poll for file changes
        while (true) {
            await this.sleep(pollInterval);

            const stats = await stat(mdConfig.filePath);

            // Check if file has been modified
            if (stats.mtimeMs > this.lastModifiedTime) {
                const content = await readFile(mdConfig.filePath, 'utf-8');
                const answer = this.extractAnswer(content, this.currentQuestion);

                if (answer) {
                    this.lastModifiedTime = stats.mtimeMs;
                    return { answer };
                }
            }
        }
    }

    /**
     * Extracts the answer for a specific question from markdown content
     */
    private extractAnswer(content: string, question: string): string | null {
        const questionHeading = `### ${question}`;
        const questionIndex = content.indexOf(questionHeading);

        if (questionIndex === -1) {
            return null;
        }

        // Find the content after the question heading
        const afterQuestion = content.slice(questionIndex + questionHeading.length);

        // Find the next heading (### or ##) or end of content
        const nextHeadingMatch = afterQuestion.match(/\n(#{2,3})\s/);
        const answerContent = nextHeadingMatch
            ? afterQuestion.slice(0, nextHeadingMatch.index)
            : afterQuestion;

        // Clean up the answer
        const answer = answerContent.trim();

        // Check if it's still the placeholder text
        if (answer === '_Awaiting answer..._' || answer === '') {
            return null;
        }

        return answer;
    }

    /**
     * Utility to sleep for a specified duration
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

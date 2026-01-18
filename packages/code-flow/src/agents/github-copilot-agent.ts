import { CopilotClient } from '@github/copilot-sdk';
import winston from 'winston';
import type { Issue, LLMAgent, LLMAgentConfig, Plan, Implementation } from '../interfaces/index.js';

/**
 * Logger instance for GitHub Copilot agent operations
 */
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'test' ? 'error' : 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
            silent: process.env.NODE_ENV === 'test',
        }),
    ],
});

/**
 * GithubCopilotAgent implements the LLMAgent interface using GitHub's Copilot SDK
 */
export class GithubCopilotAgent implements LLMAgent {
    private client: CopilotClient | null = null;

    /**
     * Lazily initialize the Copilot client
     */
    private async getClient(config?: LLMAgentConfig): Promise<CopilotClient> {
        if (!this.client) {
            const quiet = config?.quiet ?? false;
            const workingDirectory = config?.workingDirectory as string | undefined;

            if (!quiet) logger.info('Initializing GitHub Copilot client', { workingDirectory });

            this.client = new CopilotClient({
                autoStart: true,
                autoRestart: true,
                cwd: workingDirectory,
            });

            await this.client.start();
            if (!quiet) logger.info('GitHub Copilot client started');
        }
        return this.client;
    }

    /**
     * Creates a plan for resolving the issue using GitHub Copilot
     * If questions are asked and answered, it continues the same session
     */
    async plan(issue: Issue, context?: Record<string, unknown>, config?: LLMAgentConfig): Promise<Plan> {
        if (!config?.model) {
            throw new Error('GithubCopilotAgent requires a model in config');
        }

        const quiet = config.quiet ?? false;
        const client = await this.getClient(config);

        // Check if we're resuming a session (when answers are provided)
        const previousAnswers = context?.answers as Array<{ question: string; answer: string }> | undefined;
        const sessionId = context?.sessionId as string | undefined;

        let session;

        if (sessionId) {
            // Resume existing session (model cannot be changed when resuming)
            if (!quiet) logger.info('Resuming Copilot session', { sessionId });
            session = await client.resumeSession(sessionId, {
                streaming: true,
            });
        } else {
            // Create new session
            if (!quiet) logger.info('Creating new Copilot session for planning');
            session = await client.createSession({
                model: config.model,
                streaming: true,
            });
        }

        try {
            let prompt: string;

            if (previousAnswers && previousAnswers.length > 0) {
                // Continue with answers
                const answersText = previousAnswers
                    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
                    .join('\n\n');

                prompt = `Here are the answers to your questions:\n\n${answersText}\n\nNow, with this information, please provide your final plan as JSON. Use this exact structure:\n{\n  "description": "Brief description of the plan",\n  "questions": ["question1", "question2"] // omit if no more questions needed\n}`;
            } else {
                // Initial planning request
                prompt = `You are a software engineering agent. Your task is to create a plan to resolve the following issue:\n\n${issue.content}\n\nPlease analyze the issue and create a plan. If you need more information to create an effective plan, ask questions.\n\nProvide your response as JSON with this exact structure:\n{\n  "description": "Brief description of the plan",\n  "questions": ["question1", "question2"] // omit if no questions needed\n}`;
            }

            const response = await session.sendAndWait({ prompt });

            if (!quiet) {
                logger.info('Copilot plan response received', {
                    sessionId: session.sessionId,
                    hasResponse: !!response,
                });
            }

            if (!response) {
                throw new Error('No response received from Copilot');
            }

            // Extract text from response
            let fullResponse = '';
            if (response.data?.content) {
                fullResponse = response.data.content;
            }

            // Log full event for debugging token usage
            if (!quiet) {
                logger.info('Full response event', { response });
            }

            // Parse JSON response
            const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error(`Failed to extract JSON from Copilot response: ${fullResponse}`);
            }

            const planData = JSON.parse(jsonMatch[0]) as {
                description: string;
                questions?: string[];
            };

            return {
                description: planData.description,
                questions: planData.questions,
                sessionId: session.sessionId,
            };
        } finally {
            await session.destroy();
        }
    }

    /**
     * Implements the solution using GitHub Copilot
     * Creates a new session with the issue and plan context
     */
    async implement(
        issue: Issue,
        plan: Plan,
        context?: Record<string, unknown>,
        config?: LLMAgentConfig,
    ): Promise<Implementation> {
        if (!config?.model) {
            throw new Error('GithubCopilotAgent requires a model in config');
        }

        const quiet = config.quiet ?? false;
        const client = await this.getClient(config);

        if (!quiet) logger.info('Creating new Copilot session for implementation');

        const session = await client.createSession({
            model: config.model,
            streaming: true,
        });

        try {
            const prompt = `You are a software engineering agent. You need to implement the following plan:\n\nISSUE:\n${issue.content}\n\nPLAN:\n${plan.description}\n\nPlease implement this solution. You have full access to the codebase and all necessary permissions. Make the required changes to resolve the issue according to the plan.`;

            const response = await session.sendAndWait({ prompt });

            if (!quiet) {
                logger.info('Copilot implementation response received', {
                    sessionId: session.sessionId,
                    hasResponse: !!response,
                });
            }

            if (!response) {
                throw new Error('No response received from Copilot');
            }

            // Extract text from response
            let fullResponse = '';
            if (response.data?.content) {
                fullResponse = response.data.content;
            }

            // Log full event for debugging token usage
            if (!quiet) {
                logger.info('Full implementation event', { response });
            }

            return {
                description: fullResponse,
                success: true,
            };
        } catch (error) {
            if (!quiet) {
                logger.error('Copilot implementation failed', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }

            return {
                description: `Implementation failed: ${error instanceof Error ? error.message : String(error)}`,
                success: false,
            };
        } finally {
            await session.destroy();
        }
    }

    /**
     * Clean up the Copilot client
     */
    async cleanup(): Promise<void> {
        if (this.client) {
            logger.info('Stopping Copilot client');
            await this.client.stop();
            this.client = null;
        }
    }
}

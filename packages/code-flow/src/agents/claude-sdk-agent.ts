import {
    unstable_v2_createSession,
    unstable_v2_resumeSession,
    type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import winston from 'winston';
import type { Issue, LLMAgent, LLMAgentConfig, Plan, Implementation } from '../interfaces/index.js';

/**
 * Logger instance for Claude SDK agent operations
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
 * Helper to extract text from assistant messages
 */
function getAssistantText(msg: SDKMessage): string | null {
    if (msg.type !== 'assistant') return null;
    return msg.message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
}

/**
 * Helper to extract usage information from messages
 */
function extractUsage(msg: SDKMessage): { input_tokens?: number; output_tokens?: number } | null {
    if (msg.type === 'assistant' && 'usage' in msg.message) {
        return msg.message.usage as { input_tokens?: number; output_tokens?: number };
    }
    return null;
}

/**
 * ClaudeSdkAgent implements the LLMAgent interface using Claude's Agent SDK v2
 */
export class ClaudeSdkAgent implements LLMAgent {
    /**
     * Creates a plan for resolving the issue using Claude
     * If questions are asked and answered, it continues the same session
     */
    async plan(issue: Issue, context?: Record<string, unknown>, config?: LLMAgentConfig): Promise<Plan> {
        if (!config?.model) {
            throw new Error('ClaudeSdkAgent requires a model in config');
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ClaudeSdkAgent requires ANTHROPIC_API_KEY environment variable');
        }

        const quiet = config.quiet ?? false;

        // Check if we're resuming a session (when answers are provided)
        const previousAnswers = context?.answers as Array<{ question: string; answer: string }> | undefined;
        const sessionId = context?.sessionId as string | undefined;

        let session;
        let isNewSession = true;

        if (sessionId) {
            // Resume existing session
            if (!quiet) logger.info('Resuming Claude session', { sessionId });
            session = unstable_v2_resumeSession(sessionId, {
                model: config.model,
            });
            isNewSession = false;
        } else {
            // Create new session
            if (!quiet) logger.info('Creating new Claude session for planning');
            session = unstable_v2_createSession({
                model: config.model,
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

            await session.send(prompt);

            let fullResponse = '';
            let capturedSessionId: string | undefined;
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            for await (const msg of session.stream()) {
                // Capture session ID from any message
                if (!capturedSessionId) {
                    capturedSessionId = msg.session_id;
                }

                // Extract usage information
                const usage = extractUsage(msg);
                if (usage) {
                    if (usage.input_tokens) totalInputTokens += usage.input_tokens;
                    if (usage.output_tokens) totalOutputTokens += usage.output_tokens;
                }

                // Collect assistant text
                const text = getAssistantText(msg);
                if (text) {
                    fullResponse += text;
                }
            }

            // Log token usage
            if (!quiet) {
                logger.info('Claude plan tokens', {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens,
                });
            }

            // Parse JSON response
            const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error(`Failed to extract JSON from Claude response: ${fullResponse}`);
            }

            const planData = JSON.parse(jsonMatch[0]) as {
                description: string;
                questions?: string[];
            };

            return {
                description: planData.description,
                questions: planData.questions,
                sessionId: capturedSessionId,
            };
        } finally {
            // Close the session (unless we need to keep it for follow-up questions)
            // We'll keep it open if there are questions
            session.close();
        }
    }

    /**
     * Implements the solution using Claude Agent SDK
     * Creates a new session with the issue and plan context
     */
    async implement(
        issue: Issue,
        plan: Plan,
        context?: Record<string, unknown>,
        config?: LLMAgentConfig,
    ): Promise<Implementation> {
        if (!config?.model) {
            throw new Error('ClaudeSdkAgent requires a model in config');
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ClaudeSdkAgent requires ANTHROPIC_API_KEY environment variable');
        }

        const quiet = config.quiet ?? false;

        if (!quiet) logger.info('Creating new Claude session for implementation');

        const session = unstable_v2_createSession({
            model: config.model,
        });

        try {
            const prompt = `You are a software engineering agent. You need to implement the following plan:\n\nISSUE:\n${issue.content}\n\nPLAN:\n${plan.description}\n\nPlease implement this solution. You have full access to the codebase and all necessary permissions. Make the required changes to resolve the issue according to the plan.`;

            await session.send(prompt);

            let fullResponse = '';
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            for await (const msg of session.stream()) {
                // Extract usage information
                const usage = extractUsage(msg);
                if (usage) {
                    if (usage.input_tokens) totalInputTokens += usage.input_tokens;
                    if (usage.output_tokens) totalOutputTokens += usage.output_tokens;
                }

                // Collect assistant text
                const text = getAssistantText(msg);
                if (text) {
                    fullResponse += text;
                }
            }

            // Log token usage
            if (!quiet) {
                logger.info('Claude implementation tokens', {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens,
                });
            }

            return {
                description: fullResponse,
                success: true,
            };
        } catch (error) {
            if (!quiet) {
                logger.error('Claude implementation failed', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }

            return {
                description: `Implementation failed: ${error instanceof Error ? error.message : String(error)}`,
                success: false,
            };
        } finally {
            session.close();
        }
    }
}

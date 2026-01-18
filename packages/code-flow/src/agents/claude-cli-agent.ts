import { spawn } from 'node:child_process';
import winston from 'winston';
import type { Issue, LLMAgent, LLMAgentConfig, Plan, Implementation } from '../interfaces/index.js';

/**
 * Logger instance for Claude CLI agent operations
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
 * Interface for Claude CLI response
 */
interface ClaudeCliResponse {
    type?: string;
    subtype?: string;
    result?: string;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
    };
}

/**
 * ClaudeCliAgent implements the LLMAgent interface using Claude CLI
 * Invokes claude via child_process with: claude --dangerously-skip-permissions -p --output-format json
 */
export class ClaudeCliAgent implements LLMAgent {
    /**
     * Executes claude CLI command and returns parsed response
     */
    private async executeClaude(prompt: string, quiet: boolean, cwd?: string): Promise<ClaudeCliResponse> {
        return new Promise((resolve, reject) => {
            if (!quiet || process.env.DEBUG === 'true') {
                logger.info('[Claude CLI] Executing command', { cwd, promptLength: prompt.length });
            }

            const child = spawn(
                'claude',
                [
                    '--dangerously-skip-permissions',
                    '--no-session-persistence',
                    '-p',
                    '--output-format',
                    'json',
                    prompt,
                ],
                {
                    cwd: cwd || process.cwd(),
                    env: {
                        ...process.env,
                        NO_COLOR: '1',
                        TERM: 'dumb',
                    },
                    stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, capture stdout and stderr
                },
            );

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                if (!quiet) {
                    logger.error('[Claude CLI] Process error', { error: error.message });
                }
                reject(new Error(`Claude CLI execution failed: ${error.message}`));
            });

            child.on('close', (code) => {
                if (!quiet || process.env.DEBUG === 'true') {
                    logger.info('[Claude CLI] Command completed', {
                        exitCode: code,
                        stdoutLength: stdout.length,
                        stderrLength: stderr.length,
                    });
                }

                if (code !== 0) {
                    if (!quiet) {
                        logger.error('[Claude CLI] Process exited with non-zero code', {
                            exitCode: code,
                            stderr: stderr,
                            stdoutLength: stdout.length,
                        });
                    }
                    reject(
                        new Error(
                            `Claude CLI exited with code ${code}${stderr ? `: ${stderr}` : ''}`,
                        ),
                    );
                    return;
                }

                try {
                    // Parse JSON response from stdout
                    const response = JSON.parse(stdout) as ClaudeCliResponse;

                    // Log token usage if available
                    if (response.usage && !quiet) {
                        logger.info('Claude CLI tokens', {
                            inputTokens: response.usage.input_tokens ?? 0,
                            outputTokens: response.usage.output_tokens ?? 0,
                            totalTokens:
                                (response.usage.input_tokens ?? 0) +
                                (response.usage.output_tokens ?? 0),
                        });
                    }

                    resolve(response);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (!quiet) {
                        logger.error('Claude CLI JSON parse failed', { error: errorMessage, stdout });
                    }
                    reject(new Error(`Failed to parse Claude CLI response: ${errorMessage}`));
                }
            });
        });
    }

    /**
     * Creates a plan for resolving the issue using Claude CLI
     * Note: CLI doesn't support session resumption, so we recreate context with Q&A
     */
    async plan(
        issue: Issue,
        context?: Record<string, unknown>,
        config?: LLMAgentConfig,
    ): Promise<Plan> {
        if (!config?.model) {
            throw new Error('ClaudeCliAgent requires a model in config');
        }

        const quiet = config.quiet ?? false;

        // Check if we have previous answers (refinement case)
        const previousAnswers = context?.answers as
            | Array<{ question: string; answer: string }>
            | undefined;
        const originalIssue = context?.originalIssue as Issue | undefined;

        let prompt: string;

        if (previousAnswers && previousAnswers.length > 0) {
            // Include original issue + Q&A section for refinement
            const issueContent = originalIssue ? originalIssue.content : issue.content;
            const answersText = previousAnswers
                .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
                .join('\n\n');

            if (!quiet) logger.info('Refining plan with answers', { answerCount: previousAnswers.length });

            prompt = `You are a software engineering agent. Your task is to create a plan to resolve the following issue:

${issueContent}

You previously asked some questions. Here are the answers:

${answersText}

Now, with this information, please provide your final plan as JSON. Use this exact structure:
{
  "description": "Brief description of the plan",
  "questions": ["question1", "question2"] // omit if no more questions needed
}`;
        } else {
            // Initial planning request
            if (!quiet) logger.info('Creating new plan');

            prompt = `You are a software engineering agent. Your task is to create a plan to resolve the following issue:

${issue.content}

Please analyze the issue and create a plan. If you need more information to create an effective plan, ask questions.

Provide your response as JSON with this exact structure:
{
  "description": "Brief description of the plan",
  "questions": ["question1", "question2"] // omit if no questions needed
}`;
        }

        const response = await this.executeClaude(prompt, quiet, config.workingDirectory as string | undefined);

        if (!response.result) {
            throw new Error('Claude CLI returned empty response');
        }

        // Parse JSON from response result
        const jsonMatch = response.result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error(`Failed to extract JSON from Claude response: ${response.result}`);
        }

        const planData = JSON.parse(jsonMatch[0]) as {
            description: string;
            questions?: string[];
        };

        return {
            description: planData.description,
            questions: planData.questions,
            // No session ID for CLI (can't resume sessions)
            sessionId: undefined,
        };
    }

    /**
     * Implements the solution using Claude CLI
     * Creates a new invocation with the issue and plan context
     */
    async implement(
        issue: Issue,
        plan: Plan,
        context?: Record<string, unknown>,
        config?: LLMAgentConfig,
    ): Promise<Implementation> {
        if (!config?.model) {
            throw new Error('ClaudeCliAgent requires a model in config');
        }

        const quiet = config.quiet ?? false;

        if (!quiet) logger.info('Implementing solution via Claude CLI');

        const prompt = `You are a software engineering agent. You need to implement the following plan:

ISSUE:
${issue.content}

PLAN:
${plan.description}

Please implement this solution. You have full access to the codebase and all necessary permissions. Make the required changes to resolve the issue according to the plan.`;

        try {
            const response = await this.executeClaude(prompt, quiet, config.workingDirectory as string | undefined);

            if (!response.result) {
                throw new Error('Claude CLI returned empty response');
            }

            return {
                description: response.result,
                success: true,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (!quiet) {
                logger.error('Claude CLI implementation failed', {
                    error: errorMessage,
                    errorStack: error instanceof Error ? error.stack : undefined,
                });
            }

            return {
                description: `Implementation failed: ${errorMessage}`,
                success: false,
            };
        }
    }
}

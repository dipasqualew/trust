import winston from 'winston';
import { execSync } from 'child_process';
import type {
    LLMAgent,
    LLMAgentConfig,
    Sourcer,
    SourcerConfig,
    UserBridge,
    UserBridgeConfig,
    PRManager,
    PRManagerConfig,
} from './interfaces/index.js';

/**
 * Logger instance for workflow operations
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
 * Extracts an issue identifier from the sourcer config
 */
function extractIssueIdentifier(config: SourcerConfig): string {
    // For GitHub sourcer - extract issue number from URL
    if ('url' in config && typeof config.url === 'string') {
        const match = config.url.match(/\/issues\/(\d+)/);
        if (match) {
            return match[1];
        }
    }

    // For local markdown sourcer - use filename
    if ('fileName' in config && typeof config.fileName === 'string') {
        // Remove .md extension if present
        return config.fileName.replace(/\.md$/, '');
    }

    // Fallback to timestamp
    return Date.now().toString();
}

/**
 * Creates a git branch and checks it out
 */
function createAndCheckoutBranch(branchName: string): void {
    try {
        // Ensure we're on main branch and pull latest
        execSync('git checkout main', { encoding: 'utf-8', stdio: 'pipe' });

        // Delete branch if it already exists (locally)
        try {
            execSync(`git branch -D "${branchName}"`, { encoding: 'utf-8', stdio: 'pipe' });
        } catch {
            // Branch doesn't exist, that's fine
        }

        // Create and checkout new branch
        const result = execSync(`git checkout -b "${branchName}"`, { encoding: 'utf-8' });

        // Verify we're on the new branch
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
        if (currentBranch !== branchName) {
            throw new Error(`Failed to checkout branch. Current branch is ${currentBranch}, expected ${branchName}`);
        }
    } catch (error) {
        throw new Error(
            `Failed to create branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Creates a git commit with all changes
 */
function createCommit(message: string): void {
    try {
        // Verify current branch before committing
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

        // Stage all changes
        execSync('git add -A', { encoding: 'utf-8', stdio: 'pipe' });

        // Check if there are changes to commit
        try {
            execSync('git diff --cached --quiet', { encoding: 'utf-8', stdio: 'pipe' });
            // No changes to commit
            throw new Error('No changes to commit');
        } catch (diffError) {
            // There are changes, proceed with commit
        }

        // Create commit
        execSync(`git commit -m "${message}"`, { encoding: 'utf-8', stdio: 'pipe' });

        // Log the commit details
        const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
        logger.info('Commit created', {
            branch: currentBranch,
            commit: commitHash.substring(0, 7),
            message,
        });
    } catch (error) {
        throw new Error(
            `Failed to create commit: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Configuration for the workflow
 */
export interface WorkflowConfig {
    sourcer: Sourcer;
    sourcerConfig: SourcerConfig;
    userBridge: UserBridge;
    userBridgeConfig: UserBridgeConfig;
    agent: LLMAgent;
    agentConfig?: LLMAgentConfig;
    prManager: PRManager;
    prManagerConfig: PRManagerConfig;
}

/**
 * Executes the trust agentic workflow
 *
 * Steps:
 * 1. Fetch issue information from source
 * 2. Create a plan using the LLM agent
 * 3. Investigate and ask questions if needed
 * 4. Wait for answers and refine plan
 * 4.5. Create git branch
 * 5. Implement the solution
 * 6. Report implementation results
 * 6.5. Create git commit
 * 7. Open PR
 */
export async function runWorkflow(config: WorkflowConfig): Promise<void> {
    try {
        logger.info('Starting trust workflow');

        // Step 1: Fetch issue information
        logger.info('Step 1: Fetching issue information');
        const issue = await config.sourcer.fetch(config.sourcerConfig);
        logger.info('Issue fetched successfully', {
            contentLength: issue.content.length,
        });

        // Step 2: Create plan
        logger.info('Step 2: Creating plan');
        let plan = await config.agent.plan(issue, undefined, config.agentConfig);
        logger.info('Plan created', {
            description: plan.description,
            questionsCount: plan.questions?.length ?? 0,
        });

        // Step 3 & 4: Handle questions if any
        if (plan.questions && plan.questions.length > 0) {
            logger.info(`Step 3: Agent has ${plan.questions.length} questions`);

            // Collect all answers before refining
            const answers: Array<{ question: string; answer: string }> = [];

            for (const questionText of plan.questions) {
                logger.info('Asking question to user', { question: questionText });

                // Ask the question
                await config.userBridge.ask({ question: questionText }, config.userBridgeConfig);

                // Wait for answer
                logger.info('Waiting for user answer...');
                const answer = await config.userBridge.waitForAnswer(config.userBridgeConfig);
                logger.info('Received answer', { answer: answer.answer });

                // Store the Q&A pair
                answers.push({
                    question: questionText,
                    answer: answer.answer,
                });
            }

            // Re-plan with all answers collected
            logger.info('Step 4: Refining plan with all answers');
            plan = await config.agent.plan(
                issue,
                {
                    answers,
                    sessionId: plan.sessionId,
                    originalIssue: issue,
                },
                config.agentConfig,
            );
            logger.info('Plan refined');
        } else {
            logger.info('Step 3-4: No questions needed, proceeding with implementation');
        }

        // Step 4.5: Create git branch before implementation
        const issueIdentifier = extractIssueIdentifier(config.sourcerConfig);
        const branchName = `trust--${issueIdentifier}`;

        logger.info('Step 4.5: Creating and checking out git branch', { branchName });
        try {
            createAndCheckoutBranch(branchName);
            logger.info('Branch created and checked out successfully', { branchName });
        } catch (error) {
            logger.error('Failed to create branch', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }

        // Step 5: Implement the solution
        logger.info('Step 5: Implementing solution');
        const implementation = await config.agent.implement(
            issue,
            plan,
            { branchName },
            config.agentConfig,
        );
        logger.info('Implementation completed', {
            success: implementation.success,
            description: implementation.description,
        });

        // Step 6: Report results
        logger.info('Step 6: Implementation results', {
            success: implementation.success,
            description: implementation.description,
        });

        // Step 6.5: Create git commit if implementation was successful
        if (implementation.success) {
            const commitMessage = `Fixed ${issueIdentifier} (by trust)`;

            logger.info('Step 6.5: Creating git commit', { commitMessage });
            try {
                // Ensure we're on the correct branch (agent might have switched)
                const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
                if (currentBranch !== branchName) {
                    logger.warn('Agent switched branches, checking out correct branch', {
                        current: currentBranch,
                        expected: branchName,
                    });
                    execSync(`git checkout "${branchName}"`, { encoding: 'utf-8' });
                }

                createCommit(commitMessage);
                logger.info('Commit created successfully', { commitMessage });
            } catch (error) {
                logger.error('Failed to create commit', {
                    error: error instanceof Error ? error.message : String(error),
                });
                // Don't throw - commit failure shouldn't fail the entire workflow
            }
        }

        // Step 7: Create PR
        if (implementation.success) {
            logger.info('Step 7: Opening pull request');

            const prTitle = `Implement: ${plan.description.substring(0, 80)}`;
            const prBody = `## Implementation\n\n${implementation.description}\n\n---\n\nAutomated by Trust workflow`;

            try {
                const pr = await config.prManager.openPr(
                    config.prManagerConfig,
                    prTitle,
                    prBody,
                    branchName,
                );
                logger.info('Pull request created successfully', {
                    prNumber: pr.number,
                    prUrl: pr.url,
                });
            } catch (error) {
                logger.error('Failed to create pull request', {
                    error: error instanceof Error ? error.message : String(error),
                });
                // Don't throw - PR creation failure shouldn't fail the entire workflow
            }
        } else {
            logger.info('Step 7: Skipping PR creation due to implementation failure');
        }

        logger.info('Workflow completed successfully');
    } catch (error) {
        logger.error('Workflow failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

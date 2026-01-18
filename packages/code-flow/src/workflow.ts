import winston from 'winston';
import type { LLMAgent, Sourcer, SourcerConfig, UserBridge, UserBridgeConfig } from './interfaces/index.js';

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
 * Configuration for the workflow
 */
export interface WorkflowConfig {
    sourcer: Sourcer;
    sourcerConfig: SourcerConfig;
    userBridge: UserBridge;
    userBridgeConfig: UserBridgeConfig;
    agent: LLMAgent;
    agentConfig?: { quiet?: boolean };
}

/**
 * Executes the trust agentic workflow
 *
 * Steps:
 * 1. Fetch issue information from source
 * 2. Create a plan using the LLM agent
 * 3. Investigate and ask questions if needed
 * 4. Wait for answers and refine plan
 * 5. Implement the solution
 * 6. Report implementation results
 * 7. Placeholder for PR creation
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

            for (const questionText of plan.questions) {
                logger.info('Asking question to user', { question: questionText });

                // Ask the question
                await config.userBridge.ask({ question: questionText }, config.userBridgeConfig);

                // Wait for answer
                logger.info('Waiting for user answer...');
                const answer = await config.userBridge.waitForAnswer(config.userBridgeConfig);
                logger.info('Received answer', { answer: answer.answer });

                // Refine plan with new information (in a real implementation)
                // For now, we just log that we got the answer
                logger.info('Plan updated with user feedback');
            }

            // Re-plan with answers (placeholder for now)
            logger.info('Step 4: Refining plan with answers');
            plan = await config.agent.plan(issue, { answersProvided: true }, config.agentConfig);
            logger.info('Plan refined');
        } else {
            logger.info('Step 3-4: No questions needed, proceeding with implementation');
        }

        // Step 5: Implement the solution
        logger.info('Step 5: Implementing solution');
        const implementation = await config.agent.implement(issue, plan, undefined, config.agentConfig);
        logger.info('Implementation completed', {
            success: implementation.success,
            description: implementation.description,
        });

        // Step 6: Report results
        logger.info('Step 6: Implementation results', {
            success: implementation.success,
            description: implementation.description,
        });

        // Step 7: Create PR (placeholder)
        logger.info('Step 7: PR would be opened here');
        logger.info('Workflow completed successfully');
    } catch (error) {
        logger.error('Workflow failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

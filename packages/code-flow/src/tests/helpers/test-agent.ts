import type { Implementation, Issue, LLMAgent, LLMAgentConfig, Plan } from '../../interfaces/index.js';

/**
 * TestAgent is a configurable test agent that can return specific questions and results
 */
export class TestAgent implements LLMAgent {
    private questions: string[];
    private hasAskedQuestions: boolean = false;

    constructor(questions: string[] = []) {
        this.questions = questions;
    }

    async plan(
        issue: Issue,
        context?: Record<string, unknown>,
        config?: LLMAgentConfig,
    ): Promise<Plan> {
        if (!config?.quiet) {
            console.log('[TestAgent] plan() called');
        }

        // First time: return questions
        // Second time (after answers): return no questions
        if (!this.hasAskedQuestions && this.questions.length > 0) {
            this.hasAskedQuestions = true;
            return {
                description: 'Test plan requiring clarification',
                questions: this.questions,
            };
        }

        return {
            description: 'Test plan completed with user feedback',
            questions: [],
        };
    }

    async implement(
        issue: Issue,
        plan: Plan,
        context?: Record<string, unknown>,
        config?: LLMAgentConfig,
    ): Promise<Implementation> {
        if (!config?.quiet) {
            console.log('[TestAgent] implement() called');
        }

        return {
            description: 'Test implementation completed',
            success: true,
        };
    }
}

import type { Issue } from './sourcer.js';

/**
 * Represents a plan created by the agent
 */
export interface Plan {
    /** Description of the plan */
    description: string;
    /** Optional list of questions the agent needs answered */
    questions?: string[];
}

/**
 * Represents implementation results
 */
export interface Implementation {
    /** Description of what was implemented */
    description: string;
    /** Whether the implementation was successful */
    success: boolean;
}

/**
 * Configuration for an LLMAgent implementation
 */
export interface LLMAgentConfig {
    [key: string]: unknown;
}

/**
 * LLMAgent handles the planning and implementation phases of issue resolution
 */
export interface LLMAgent {
    /**
     * Creates a plan for resolving the issue
     * @param issue The issue to plan for
     * @param context Additional context (e.g., codebase information)
     * @returns Promise resolving to a Plan
     */
    plan(issue: Issue, context?: Record<string, unknown>, config?: LLMAgentConfig): Promise<Plan>;

    /**
     * Implements the solution based on the issue and plan
     * @param issue The issue to implement
     * @param plan The plan to follow
     * @param context Additional context
     * @returns Promise resolving to Implementation results
     */
    implement(
        issue: Issue,
        plan: Plan,
        context?: Record<string, unknown>,
        config?: LLMAgentConfig
    ): Promise<Implementation>;
}

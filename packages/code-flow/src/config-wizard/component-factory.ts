/**
 * Factory for instantiating components from configuration.
 */

import type { Sourcer } from '../interfaces/sourcer.js';
import type { UserBridge } from '../interfaces/user-bridge.js';
import type { LLMAgent } from '../interfaces/llm-agent.js';

import { LocalMarkdownSourcer, GitHubSourcer } from '../sourcers/index.js';
import { MarkdownUserBridge, GitHubUserBridge, MacosUserBridge } from '../bridges/index.js';
import { ClaudeCliAgent, ClaudeSdkAgent, GithubCopilotAgent, VoidAgent } from '../agents/index.js';

export interface ProfileConfig {
    sourcer: {
        type: string;
        config: Record<string, unknown>;
    };
    bridge: {
        type: string;
        config: Record<string, unknown>;
    };
    agent: {
        type: string;
        config: Record<string, unknown>;
    };
}

/**
 * Creates a sourcer instance from profile configuration.
 */
export function createSourcer(type: string): Sourcer {
    switch (type) {
    case 'LocalMarkdownSourcer':
        return new LocalMarkdownSourcer();
    case 'GitHubSourcer':
        return new GitHubSourcer();
    default:
        throw new Error(`Unknown sourcer type: ${type}`);
    }
}

/**
 * Creates a user bridge instance from profile configuration.
 */
export function createUserBridge(type: string): UserBridge {
    switch (type) {
    case 'MarkdownUserBridge':
        return new MarkdownUserBridge();
    case 'GitHubUserBridge':
        return new GitHubUserBridge();
    case 'MacosUserBridge':
        return new MacosUserBridge();
    default:
        throw new Error(`Unknown user bridge type: ${type}`);
    }
}

/**
 * Creates an agent instance from profile configuration.
 */
export function createAgent(type: string): LLMAgent {
    switch (type) {
    case 'ClaudeCliAgent':
        return new ClaudeCliAgent();
    case 'ClaudeSdkAgent':
        return new ClaudeSdkAgent();
    case 'GithubCopilotAgent':
        return new GithubCopilotAgent();
    case 'VoidAgent':
        return new VoidAgent();
    default:
        throw new Error(`Unknown agent type: ${type}`);
    }
}

/**
 * Creates all components from a profile configuration.
 */
export function createComponentsFromProfile(profile: ProfileConfig): {
    sourcer: Sourcer;
    sourcerConfig: Record<string, unknown>;
    userBridge: UserBridge;
    userBridgeConfig: Record<string, unknown>;
    agent: LLMAgent;
    agentConfig?: Record<string, unknown>;
} {
    // Convert modelName to model for agent config if needed
    const agentConfig = { ...profile.agent.config };
    if ('modelName' in agentConfig && !('model' in agentConfig)) {
        agentConfig.model = agentConfig.modelName;
        delete agentConfig.modelName;
    }

    return {
        sourcer: createSourcer(profile.sourcer.type),
        sourcerConfig: profile.sourcer.config,
        userBridge: createUserBridge(profile.bridge.type),
        userBridgeConfig: profile.bridge.config,
        agent: createAgent(profile.agent.type),
        agentConfig,
    };
}

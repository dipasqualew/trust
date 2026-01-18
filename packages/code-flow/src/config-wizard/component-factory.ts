/**
 * Factory for instantiating components from configuration.
 */

import type { Sourcer } from '../interfaces/sourcer.js';
import type { UserBridge } from '../interfaces/user-bridge.js';
import type { LLMAgent } from '../interfaces/llm-agent.js';
import type { PRManager } from '../interfaces/pr-manager.js';

import { LocalMarkdownSourcer, GitHubSourcer } from '../sourcers/index.js';
import { MarkdownUserBridge, GitHubUserBridge, MacosUserBridge } from '../bridges/index.js';
import { ClaudeCliAgent, ClaudeSdkAgent, GithubCopilotAgent, VoidAgent } from '../agents/index.js';
import { GitHubPRManager } from '../pr-managers/index.js';

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
    prManager: {
        type: string;
        config: Record<string, unknown>;
    };
}

/**
 * Migrates a legacy profile to include prManager if missing.
 * Uses the same token as the bridge if it's a GitHub bridge.
 */
export function migrateProfile(profile: Partial<ProfileConfig>): ProfileConfig {
    // If prManager is missing, add a default based on bridge type
    if (!profile.prManager) {
        const bridgeType = profile.bridge?.type;
        const bridgeToken = profile.bridge?.config?.token;

        // Default to GitHubPRManager with token from bridge if available
        profile.prManager = {
            type: 'GitHubPRManager',
            config: bridgeToken && typeof bridgeToken === 'string'
                ? { token: bridgeToken }
                : {},
        };
    }

    return profile as ProfileConfig;
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
 * Creates a PR manager instance from profile configuration.
 */
export function createPRManager(type: string): PRManager {
    switch (type) {
        case 'GitHubPRManager':
            return new GitHubPRManager();
        default:
            throw new Error(`Unknown PR manager type: ${type}`);
    }
}

/**
 * Creates all components from a profile configuration.
 * Automatically migrates legacy profiles that don't have prManager.
 */
export function createComponentsFromProfile(profile: Partial<ProfileConfig>): {
    sourcer: Sourcer;
    sourcerConfig: Record<string, unknown>;
    userBridge: UserBridge;
    userBridgeConfig: Record<string, unknown>;
    agent: LLMAgent;
    agentConfig?: Record<string, unknown>;
    prManager: PRManager;
    prManagerConfig: Record<string, unknown>;
} {
    // Migrate profile if needed
    const migratedProfile = migrateProfile(profile);

    // Convert modelName to model for agent config if needed
    const agentConfig = { ...migratedProfile.agent.config };
    if ('modelName' in agentConfig && !('model' in agentConfig)) {
        agentConfig.model = agentConfig.modelName;
        delete agentConfig.modelName;
    }

    return {
        sourcer: createSourcer(migratedProfile.sourcer.type),
        sourcerConfig: migratedProfile.sourcer.config,
        userBridge: createUserBridge(migratedProfile.bridge.type),
        userBridgeConfig: migratedProfile.bridge.config,
        agent: createAgent(migratedProfile.agent.type),
        agentConfig,
        prManager: createPRManager(migratedProfile.prManager.type),
        prManagerConfig: migratedProfile.prManager.config,
    };
}

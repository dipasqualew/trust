/**
 * Wizard orchestrator that coordinates the configuration flow.
 */

import { ConfigManager } from '../config.js';
import {
    buildConfigurationFlow,
    buildComponentConfigQuestions,
    type ConfigurationFlow,
} from './flow-model.js';
import {
    getAvailableComponents,
    getComponentMetadata,
    validateComponentAvailability,
} from './component-registry.js';
import {
    renderConfigurationFlow,
    renderQuestions,
    promptProfileSelection,
    promptSetDefaultProfile,
    type AnswerSet,
} from './terminal-renderer.js';
import type { ProfileConfig } from './component-factory.js';
import { execSync } from 'node:child_process';

/**
 * Checks if a CLI tool exists on the system.
 */
function cliExists(cli: string): boolean {
    try {
        execSync(`which ${cli}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Checks if an environment variable is set.
 */
function envExists(env: string): boolean {
    return !!process.env[env];
}

/**
 * Converts flat answer set to profile config structure.
 */
function answersToProfile(flatAnswers: AnswerSet): ProfileConfig {
    const profile: ProfileConfig = {
        sourcer: {
            type: String(flatAnswers['sourcer.type']),
            config: {},
        },
        bridge: {
            type: String(flatAnswers['bridge.type']),
            config: {},
        },
        agent: {
            type: String(flatAnswers['agent.type']),
            config: {},
        },
    };

    // Extract sourcer config
    for (const key in flatAnswers) {
        if (key.startsWith('sourcer.config.')) {
            const configKey = key.replace('sourcer.config.', '');
            const value = flatAnswers[key];
            // Convert numeric strings to numbers where appropriate
            if (configKey === 'pollInterval' && typeof value === 'string') {
                profile.sourcer.config[configKey] = parseInt(value, 10);
            } else {
                profile.sourcer.config[configKey] = value;
            }
        }
    }

    // Extract bridge config
    for (const key in flatAnswers) {
        if (key.startsWith('bridge.config.')) {
            const configKey = key.replace('bridge.config.', '');
            const value = flatAnswers[key];
            // Convert numeric strings to numbers where appropriate
            if ((configKey === 'pollInterval' || configKey === 'issueNumber') && typeof value === 'string') {
                profile.bridge.config[configKey] = parseInt(value, 10);
            } else {
                profile.bridge.config[configKey] = value;
            }
        }
    }

    // Extract agent config
    for (const key in flatAnswers) {
        if (key.startsWith('agent.config.')) {
            const configKey = key.replace('agent.config.', '');
            profile.agent.config[configKey] = flatAnswers[key];
        }
    }

    return profile;
}

/**
 * Validates selected components and shows warnings/errors.
 */
function validateSelectedComponents(
    sourcerType: string,
    bridgeType: string,
    agentType: string,
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const platform = process.platform;

    // Validate sourcer
    const sourcerMeta = getComponentMetadata('sourcer', sourcerType);
    if (sourcerMeta) {
        const error = validateComponentAvailability(sourcerMeta, platform, cliExists, envExists);
        if (error) errors.push(error);
    }

    // Validate bridge
    const bridgeMeta = getComponentMetadata('bridge', bridgeType);
    if (bridgeMeta) {
        const error = validateComponentAvailability(bridgeMeta, platform, cliExists, envExists);
        if (error) errors.push(error);
    }

    // Validate agent
    const agentMeta = getComponentMetadata('agent', agentType);
    if (agentMeta) {
        const error = validateComponentAvailability(agentMeta, platform, cliExists, envExists);
        if (error) errors.push(error);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Runs the complete configuration wizard flow.
 */
export async function runConfigurationWizard(configManager?: ConfigManager): Promise<void> {
    const manager = configManager ?? new ConfigManager();

    console.log('\n✨ Welcome to Trust Configuration Wizard\n');

    // Step 1: Profile selection
    const existingProfiles = await manager.listProfiles();
    const { action, profileName } = await promptProfileSelection(existingProfiles);

    if (!profileName) {
        throw new Error('Profile name is required');
    }

    let existingProfile: ProfileConfig | undefined;
    if (action === 'select') {
        existingProfile = await manager.getProfile(profileName);
    }

    // Step 2: Get available components
    const currentPlatform = process.platform;
    const availableSourcers = getAvailableComponents('sourcer', currentPlatform);
    const availableBridges = getAvailableComponents('bridge', currentPlatform);
    const availableAgents = getAvailableComponents('agent', currentPlatform);

    // Step 3: Build and render configuration flow
    const flow = buildConfigurationFlow(
        availableSourcers.map((m) => ({ name: m.displayName, value: m.name, description: m.description })),
        availableBridges.map((m) => ({ name: m.displayName, value: m.name, description: m.description })),
        availableAgents.map((m) => ({ name: m.displayName, value: m.name, description: m.description })),
    );

    const answers = await renderConfigurationFlow(flow);

    // Flatten nested answers to extract types (inquirer interprets dots as paths)
    function flattenAnswers(obj: any, prefix = ''): AnswerSet {
        const result: AnswerSet = {};
        for (const key in obj) {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                Object.assign(result, flattenAnswers(value, newKey));
            } else {
                result[newKey] = value;
            }
        }
        return result;
    }

    let flatAnswers = flattenAnswers(answers);

    // Step 4: Get component-specific configuration
    const sourcerType = String(flatAnswers['sourcer.type']);
    const bridgeType = String(flatAnswers['bridge.type']);
    const agentType = String(flatAnswers['agent.type']);

    // Validate component selections
    const validation = validateSelectedComponents(sourcerType, bridgeType, agentType);
    if (!validation.valid) {
        console.error('\n❌ Component validation failed:');
        validation.errors.forEach((error) => console.error(`  - ${error}`));
        console.error('\nPlease fix these issues and run the wizard again.\n');
        process.exit(1);
    }

    // Get component-specific config questions
    const sourcerConfigQuestions = buildComponentConfigQuestions('sourcer', sourcerType);
    if (sourcerConfigQuestions.length > 0) {
        console.log(`\n=== Configure ${sourcerType} ===\n`);
        // Render all questions at once to avoid nested object overwrites
        for (const question of sourcerConfigQuestions) {
            const answer = await renderQuestions([question]);
            const flatAnswer = flattenAnswers(answer);
            Object.assign(flatAnswers, flatAnswer);
        }
    }

    const bridgeConfigQuestions = buildComponentConfigQuestions('bridge', bridgeType);
    if (bridgeConfigQuestions.length > 0) {
        console.log(`\n=== Configure ${bridgeType} ===\n`);
        // Render all questions at once to avoid nested object overwrites
        for (const question of bridgeConfigQuestions) {
            const answer = await renderQuestions([question]);
            const flatAnswer = flattenAnswers(answer);
            Object.assign(flatAnswers, flatAnswer);
        }
    }

    const agentConfigQuestions = buildComponentConfigQuestions('agent', agentType);
    if (agentConfigQuestions.length > 0) {
        console.log(`\n=== Configure ${agentType} ===\n`);
        // Render all questions at once to avoid nested object overwrites
        for (const question of agentConfigQuestions) {
            const answer = await renderQuestions([question]);
            const flatAnswer = flattenAnswers(answer);
            Object.assign(flatAnswers, flatAnswer);
        }
    }

    // Convert to profile config
    const profile = answersToProfile(flatAnswers);

    // Step 6: Save profile
    await manager.saveProfile(profileName, profile);
    console.log(`\n✅ Profile "${profileName}" saved successfully!`);

    // Step 7: Set as default if needed
    const currentDefault = await manager.getDefaultProfile();
    if (!currentDefault || action === 'create') {
        const shouldSetDefault = await promptSetDefaultProfile(profileName);
        if (shouldSetDefault) {
            await manager.setDefaultProfile(profileName);
            console.log(`✅ "${profileName}" is now the default profile`);
        }
    }

    console.log('\n');
}

/**
 * Ensures a default profile exists, running wizard if needed.
 * Returns the profile name to use.
 */
export async function ensureDefaultProfile(configManager?: ConfigManager): Promise<string> {
    const manager = configManager ?? new ConfigManager();

    // Check if any profiles exist
    const hasProfiles = await manager.hasProfiles();

    if (!hasProfiles) {
        console.log('\n⚠️  No configuration found. Running setup wizard...\n');
        await runConfigurationWizard(manager);
    }

    // Get default profile
    const defaultProfile = await manager.getDefaultProfile();

    if (!defaultProfile) {
        // Profiles exist but no default set
        const profiles = await manager.listProfiles();
        if (profiles.length === 1) {
            // Only one profile, use it as default
            await manager.setDefaultProfile(profiles[0]);
            return profiles[0];
        }

        // Multiple profiles but no default - should not happen, but handle gracefully
        throw new Error(
            'Multiple profiles exist but no default is set. Please run with --configure to set a default profile.',
        );
    }

    return defaultProfile;
}

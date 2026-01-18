/**
 * Component registry with metadata for all available sourcers, bridges, and agents.
 */

export interface ComponentMetadata {
    name: string;
    displayName: string;
    description: string;
    requiresPlatform?: 'darwin' | 'linux' | 'win32';
    requiresCli?: string; // CLI tool that must be installed
    requiresEnv?: string[]; // Environment variables that must be set
}

export interface ComponentRegistry {
    sourcers: Map<string, ComponentMetadata>;
    bridges: Map<string, ComponentMetadata>;
    agents: Map<string, ComponentMetadata>;
}

const sourcerRegistry = new Map<string, ComponentMetadata>([
    [
        'LocalMarkdownSourcer',
        {
            name: 'LocalMarkdownSourcer',
            displayName: 'Local Markdown Files',
            description: 'Read issues from local markdown files in a directory',
        },
    ],
    [
        'GitHubSourcer',
        {
            name: 'GitHubSourcer',
            displayName: 'GitHub Issues',
            description: 'Fetch issues from GitHub repositories',
        },
    ],
]);

const bridgeRegistry = new Map<string, ComponentMetadata>([
    [
        'MarkdownUserBridge',
        {
            name: 'MarkdownUserBridge',
            displayName: 'Markdown File Q&A',
            description: 'Communicate via markdown file with polling for answers',
        },
    ],
    [
        'GitHubUserBridge',
        {
            name: 'GitHubUserBridge',
            displayName: 'GitHub Comments',
            description: 'Post questions as GitHub comments and poll for answers',
        },
    ],
    [
        'MacosUserBridge',
        {
            name: 'MacosUserBridge',
            displayName: 'macOS Dialog Boxes',
            description: 'Use native macOS dialog boxes for direct user interaction',
            requiresPlatform: 'darwin',
        },
    ],
]);

const agentRegistry = new Map<string, ComponentMetadata>([
    [
        'ClaudeCliAgent',
        {
            name: 'ClaudeCliAgent',
            displayName: 'Claude CLI',
            description: 'Use Claude via the claude CLI tool (stateless)',
            requiresCli: 'claude',
        },
    ],
    [
        'ClaudeSdkAgent',
        {
            name: 'ClaudeSdkAgent',
            displayName: 'Claude SDK',
            description: 'Use Claude via Anthropic SDK (supports session resumption)',
            requiresEnv: ['ANTHROPIC_API_KEY'],
        },
    ],
    [
        'GithubCopilotAgent',
        {
            name: 'GithubCopilotAgent',
            displayName: 'GitHub Copilot',
            description: 'Use GitHub Copilot SDK (supports session resumption)',
        },
    ],
    [
        'VoidAgent',
        {
            name: 'VoidAgent',
            displayName: 'Void Agent (Testing)',
            description: 'Mock agent for testing - does not perform actual work',
        },
    ],
]);

export const componentRegistry: ComponentRegistry = {
    sourcers: sourcerRegistry,
    bridges: bridgeRegistry,
    agents: agentRegistry,
};

/**
 * Gets all available components of a given type, optionally filtered by platform.
 */
export function getAvailableComponents(
    type: 'sourcer' | 'bridge' | 'agent',
    currentPlatform?: string,
): ComponentMetadata[] {
    const registry =
        type === 'sourcer'
            ? componentRegistry.sourcers
            : type === 'bridge'
                ? componentRegistry.bridges
                : componentRegistry.agents;

    return Array.from(registry.values()).filter((meta) => {
        // Filter by platform if specified
        if (meta.requiresPlatform && currentPlatform && meta.requiresPlatform !== currentPlatform) {
            return false;
        }
        return true;
    });
}

/**
 * Gets metadata for a specific component.
 */
export function getComponentMetadata(
    type: 'sourcer' | 'bridge' | 'agent',
    name: string,
): ComponentMetadata | undefined {
    const registry =
        type === 'sourcer'
            ? componentRegistry.sourcers
            : type === 'bridge'
                ? componentRegistry.bridges
                : componentRegistry.agents;

    return registry.get(name);
}

/**
 * Validates if a component can be used on the current system.
 * Returns an error message if validation fails, or null if OK.
 */
export function validateComponentAvailability(
    metadata: ComponentMetadata,
    currentPlatform: string,
    checkCliExists?: (cli: string) => boolean,
    checkEnvExists?: (env: string) => boolean,
): string | null {
    // Check platform requirement
    if (metadata.requiresPlatform && metadata.requiresPlatform !== currentPlatform) {
        return `${metadata.displayName} requires ${metadata.requiresPlatform} platform (current: ${currentPlatform})`;
    }

    // Check CLI requirement
    if (metadata.requiresCli && checkCliExists) {
        if (!checkCliExists(metadata.requiresCli)) {
            return `${metadata.displayName} requires '${metadata.requiresCli}' CLI tool to be installed`;
        }
    }

    // Check environment variables
    if (metadata.requiresEnv && checkEnvExists) {
        for (const env of metadata.requiresEnv) {
            if (!checkEnvExists(env)) {
                return `${metadata.displayName} requires ${env} environment variable to be set`;
            }
        }
    }

    return null;
}

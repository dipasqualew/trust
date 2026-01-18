/**
 * Renderer-agnostic configuration flow model.
 * Defines questions and flow logic without any terminal UI dependencies.
 */

export type QuestionType = 'text' | 'password' | 'select' | 'confirm';

export interface BaseQuestion {
    id: string;
    type: QuestionType;
    message: string;
    required?: boolean;
    validate?: (value: unknown) => true | string;
}

export interface TextQuestion extends BaseQuestion {
    type: 'text';
    default?: string;
}

export interface PasswordQuestion extends BaseQuestion {
    type: 'password';
}

export interface SelectQuestion extends BaseQuestion {
    type: 'select';
    choices: Array<{ name: string; value: string; description?: string }>;
    default?: string;
}

export interface ConfirmQuestion extends BaseQuestion {
    type: 'confirm';
    default?: boolean;
}

export type Question = TextQuestion | PasswordQuestion | SelectQuestion | ConfirmQuestion;

export interface ConfigurationStep {
    id: string;
    title: string;
    questions: Question[];
}

export interface ConfigurationFlow {
    steps: ConfigurationStep[];
}

/**
 * Builds the complete configuration flow for a profile.
 * This includes sourcer, bridge, and agent configuration.
 */
export function buildConfigurationFlow(
    availableSourcers: Array<{ name: string; value: string; description?: string }>,
    availableBridges: Array<{ name: string; value: string; description?: string }>,
    availableAgents: Array<{ name: string; value: string; description?: string }>,
): ConfigurationFlow {
    return {
        steps: [
            {
                id: 'sourcer',
                title: 'Configure Sourcer',
                questions: [
                    {
                        id: 'sourcer.type',
                        type: 'select',
                        message: 'Select a sourcer (where issues come from):',
                        choices: availableSourcers,
                        required: true,
                    },
                ],
            },
            {
                id: 'bridge',
                title: 'Configure User Bridge',
                questions: [
                    {
                        id: 'bridge.type',
                        type: 'select',
                        message: 'Select a user bridge (how to communicate with users):',
                        choices: availableBridges,
                        required: true,
                    },
                ],
            },
            {
                id: 'agent',
                title: 'Configure Agent',
                questions: [
                    {
                        id: 'agent.type',
                        type: 'select',
                        message: 'Select an LLM agent (AI that implements the solution):',
                        choices: availableAgents,
                        required: true,
                    },
                ],
            },
        ],
    };
}

/**
 * Builds dynamic questions based on selected component types.
 * This is called after the user selects sourcer/bridge/agent types.
 */
export function buildComponentConfigQuestions(
    componentType: 'sourcer' | 'bridge' | 'agent',
    selectedType: string,
): Question[] {
    const prefix = componentType;

    switch (selectedType) {
        // Sourcers
        case 'LocalMarkdownSourcer':
            return []; // No persistent config - sourceDir and fileName are runtime arguments

        case 'GitHubSourcer':
            return [
                {
                    id: `${prefix}.config.token`,
                    type: 'password',
                    message: 'Enter your GitHub Personal Access Token:',
                    required: true,
                    validate: (value) => (value && String(value).trim() !== '' ? true : 'GitHub token is required'),
                },
            ];

        // Bridges
        case 'MarkdownUserBridge':
            return [
                {
                    id: `${prefix}.config.pollInterval`,
                    type: 'select',
                    message: 'Select polling interval:',
                    required: false,
                    choices: [
                        { name: '30 seconds (30000 ms)', value: '30000' },
                        { name: '1 minute (60000 ms) - Recommended', value: '60000' },
                        { name: '2 minutes (120000 ms)', value: '120000' },
                        { name: '5 minutes (300000 ms)', value: '300000' },
                    ],
                    default: '60000',
                },
            ];

        case 'GitHubUserBridge':
            return [
                {
                    id: `${prefix}.config.token`,
                    type: 'password',
                    message: 'Enter your GitHub Personal Access Token:',
                    required: true,
                    validate: (value) => (value && String(value).trim() !== '' ? true : 'GitHub token is required'),
                },
                {
                    id: `${prefix}.config.pollInterval`,
                    type: 'select',
                    message: 'Select polling interval:',
                    required: false,
                    choices: [
                        { name: '30 seconds (30000 ms)', value: '30000' },
                        { name: '1 minute (60000 ms) - Recommended', value: '60000' },
                        { name: '2 minutes (120000 ms)', value: '120000' },
                        { name: '5 minutes (300000 ms)', value: '300000' },
                    ],
                    default: '60000',
                },
            ];

        case 'MacosUserBridge':
            return []; // No config needed

        // Agents
        case 'ClaudeCliAgent':
            return [
                {
                    id: `${prefix}.config.modelName`,
                    type: 'select',
                    message: 'Select the Claude model:',
                    required: true,
                    choices: [
                        { name: 'Claude Sonnet 4 (Latest)', value: 'claude-sonnet-4-20250514' },
                        { name: 'Claude Opus 4', value: 'claude-opus-4-20250514' },
                        { name: 'Claude Sonnet 3.5', value: 'claude-3-5-sonnet-20241022' },
                        { name: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
                    ],
                    default: 'claude-sonnet-4-20250514',
                },
                {
                    id: `${prefix}.config.workingDirectory`,
                    type: 'text',
                    message: 'Enter working directory for CLI execution (optional):',
                    required: false,
                },
                {
                    id: `${prefix}.config.quiet`,
                    type: 'confirm',
                    message: 'Suppress logging?',
                    required: false,
                    default: false,
                },
            ];

        case 'ClaudeSdkAgent':
            return [
                {
                    id: `${prefix}.config.modelName`,
                    type: 'select',
                    message: 'Select the Claude model:',
                    required: true,
                    choices: [
                        { name: 'Claude Sonnet 4 (Latest)', value: 'claude-sonnet-4-20250514' },
                        { name: 'Claude Opus 4', value: 'claude-opus-4-20250514' },
                        { name: 'Claude Sonnet 3.5', value: 'claude-3-5-sonnet-20241022' },
                        { name: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
                    ],
                    default: 'claude-sonnet-4-20250514',
                },
                {
                    id: `${prefix}.config.quiet`,
                    type: 'confirm',
                    message: 'Suppress logging?',
                    required: false,
                    default: false,
                },
            ];

        case 'GithubCopilotAgent':
            return [
                {
                    id: `${prefix}.config.modelName`,
                    type: 'select',
                    message: 'Select the model:',
                    required: true,
                    choices: [
                        { name: 'GPT-4o (Recommended)', value: 'gpt-4o' },
                        { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
                        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                        { name: 'o1 (Reasoning)', value: 'o1' },
                        { name: 'o1 Mini', value: 'o1-mini' },
                    ],
                    default: 'gpt-4o',
                },
                {
                    id: `${prefix}.config.workingDirectory`,
                    type: 'text',
                    message: 'Enter working directory for the client (optional):',
                    required: false,
                },
                {
                    id: `${prefix}.config.quiet`,
                    type: 'confirm',
                    message: 'Suppress logging?',
                    required: false,
                    default: false,
                },
            ];

        case 'VoidAgent':
            return [
                {
                    id: `${prefix}.config.quiet`,
                    type: 'confirm',
                    message: 'Suppress logging?',
                    required: false,
                    default: false,
                },
            ];

        default:
            return [];
    }
}

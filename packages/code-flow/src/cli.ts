#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import winston from 'winston';
import { ConfigManager } from './config.js';
import { runWorkflow } from './workflow.js';
import { runConfigurationWizard, ensureDefaultProfile, createComponentsFromProfile } from './config-wizard/index.js';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
    ],
});

interface RunCommandArgs {
    profile?: string;
    configPath?: string;
    // Runtime arguments for sourcers
    sourceDir?: string;
    fileName?: string;
    issueUrl?: string;
    // Runtime arguments for bridges
    filePath?: string;
    owner?: string;
    repo?: string;
    issueNumber?: number;
}

yargs(hideBin(process.argv))
    .command(
        'run',
        'Run the trust workflow',
        (yargs) => {
            return yargs
                .option('profile', {
                    alias: 'p',
                    type: 'string',
                    description: 'Profile to use (defaults to the default profile)',
                })
                .option('config-path', {
                    alias: 'c',
                    type: 'string',
                    description: 'Path to config directory (defaults to current directory)',
                })
                // Sourcer runtime arguments
                .option('source-dir', {
                    type: 'string',
                    description: 'Directory containing markdown files (for LocalMarkdownSourcer)',
                })
                .option('file-name', {
                    type: 'string',
                    description: 'Specific markdown filename (for LocalMarkdownSourcer)',
                })
                .option('issue-url', {
                    type: 'string',
                    description: 'GitHub issue URL (for GitHubSourcer)',
                })
                // Bridge runtime arguments
                .option('file-path', {
                    type: 'string',
                    description: 'Markdown file path for Q&A (for MarkdownUserBridge)',
                })
                .option('owner', {
                    type: 'string',
                    description: 'Repository owner (for GitHubUserBridge)',
                })
                .option('repo', {
                    type: 'string',
                    description: 'Repository name (for GitHubUserBridge)',
                })
                .option('issue-number', {
                    type: 'number',
                    description: 'Issue number (for GitHubUserBridge)',
                });
        },
        async (argv) => {
            try {
                const args = argv as unknown as RunCommandArgs;

                // Initialize ConfigManager
                const configManager = new ConfigManager(args.configPath);

                // Ensure a default profile exists (will run wizard if needed)
                const profileToUse = args.profile ?? (await ensureDefaultProfile(configManager));

                logger.info('Loading profile', { profile: profileToUse });

                // Load profile
                const profile = await configManager.getProfile(profileToUse);
                if (!profile) {
                    logger.error(`Profile "${profileToUse}" not found`);
                    process.exit(1);
                }

                // Create components from profile
                const { sourcer, sourcerConfig, userBridge, userBridgeConfig, agent, agentConfig, prManager, prManagerConfig } =
                    createComponentsFromProfile(profile);

                // Merge profile config with runtime arguments
                const finalSourcerConfig = {
                    ...sourcerConfig,
                    ...(args.sourceDir && { sourceDir: args.sourceDir }),
                    ...(args.fileName && { fileName: args.fileName }),
                    ...(args.issueUrl && { url: args.issueUrl }), // Map issueUrl to url for GitHubSourcer
                };

                const finalUserBridgeConfig = {
                    ...userBridgeConfig,
                    ...(args.filePath && { filePath: args.filePath }),
                    ...(args.owner && { owner: args.owner }),
                    ...(args.repo && { repo: args.repo }),
                    ...(args.issueNumber && { issueNumber: args.issueNumber }),
                };

                // Validate required runtime arguments based on component types
                if (profile.sourcer.type === 'LocalMarkdownSourcer' && !finalSourcerConfig.sourceDir) {
                    logger.error('--source-dir is required for LocalMarkdownSourcer');
                    process.exit(1);
                }
                if (profile.sourcer.type === 'GitHubSourcer' && !args.issueUrl) {
                    logger.error('--issue-url is required for GitHubSourcer');
                    process.exit(1);
                }
                if (profile.bridge.type === 'MarkdownUserBridge' && !finalUserBridgeConfig.filePath) {
                    logger.error('--file-path is required for MarkdownUserBridge');
                    process.exit(1);
                }
                if (profile.bridge.type === 'GitHubUserBridge') {
                    if (!finalUserBridgeConfig.owner || !finalUserBridgeConfig.repo || !finalUserBridgeConfig.issueNumber) {
                        logger.error('--owner, --repo, and --issue-number are required for GitHubUserBridge');
                        process.exit(1);
                    }
                }

                logger.info('Starting trust workflow', {
                    sourcer: profile.sourcer.type,
                    bridge: profile.bridge.type,
                    agent: profile.agent.type,
                    prManager: profile.prManager.type,
                });

                // Run workflow
                await runWorkflow({
                    sourcer,
                    sourcerConfig: finalSourcerConfig,
                    userBridge,
                    userBridgeConfig: finalUserBridgeConfig,
                    agent,
                    agentConfig: agentConfig as any, // Config already validated in wizard
                    prManager,
                    prManagerConfig,
                });

                logger.info('Workflow completed successfully');
                process.exit(0);
            } catch (error) {
                logger.error('Workflow execution failed', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                process.exit(1);
            }
        },
    )
    .command(
        'configure',
        'Configure trust profiles interactively',
        (yargs) => {
            return yargs.option('config-path', {
                alias: 'c',
                type: 'string',
                description: 'Path to config directory (defaults to current directory)',
            });
        },
        async (argv) => {
            try {
                const args = argv as unknown as RunCommandArgs;
                const configManager = new ConfigManager(args.configPath);

                await runConfigurationWizard(configManager);
                process.exit(0);
            } catch (error) {
                logger.error('Configuration failed', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                process.exit(1);
            }
        },
    )
    .command(
        'config',
        'Manage trust configuration',
        (yargs) => {
            return yargs
                .command(
                    'show',
                    'Show current configuration',
                    {},
                    async () => {
                        try {
                            const configManager = new ConfigManager();
                            const config = await configManager.read();
                            console.log(JSON.stringify(config, null, 2));
                        } catch (error) {
                            logger.error('Failed to read configuration', {
                                error: error instanceof Error ? error.message : String(error),
                            });
                            process.exit(1);
                        }
                    },
                )
                .demandCommand(1, 'You must specify a config subcommand');
        },
    )
    .demandCommand(1, 'You must specify a command')
    .help()
    .alias('help', 'h')
    .alias('version', 'v')
    .parse();

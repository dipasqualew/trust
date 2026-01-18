#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import winston from 'winston';
import { ConfigManager } from './config.js';
import { runWorkflow } from './workflow.js';
import { LocalMarkdownSourcer } from './sourcers/index.js';
import { MarkdownUserBridge } from './bridges/index.js';
import { VoidAgent } from './agents/index.js';

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
    sourceDir: string;
    fileName?: string;
    issueFile?: string;
    configPath?: string;
}

yargs(hideBin(process.argv))
    .command(
        'run',
        'Run the trust workflow',
        (yargs) => {
            return yargs
                .option('source-dir', {
                    alias: 's',
                    type: 'string',
                    description: 'Directory containing issue markdown files',
                    demandOption: true,
                })
                .option('file-name', {
                    alias: 'f',
                    type: 'string',
                    description: 'Specific markdown file to process',
                })
                .option('issue-file', {
                    alias: 'i',
                    type: 'string',
                    description: 'Markdown file to use for Q&A',
                })
                .option('config-path', {
                    alias: 'c',
                    type: 'string',
                    description: 'Path to config directory (defaults to monorepo root)',
                });
        },
        async (argv) => {
            try {
                const args = argv as unknown as RunCommandArgs;

                logger.info('Initializing trust workflow', {
                    sourceDir: args.sourceDir,
                    fileName: args.fileName,
                    issueFile: args.issueFile,
                });

                // Initialize components
                const sourcer = new LocalMarkdownSourcer();
                const userBridge = new MarkdownUserBridge();
                const agent = new VoidAgent();

                // Determine issue file path
                const issueFilePath = args.issueFile ?? `${args.sourceDir}/${args.fileName ?? 'issue.md'}`;

                // Run workflow
                await runWorkflow({
                    sourcer,
                    sourcerConfig: {
                        sourceDir: args.sourceDir,
                        fileName: args.fileName,
                    },
                    userBridge,
                    userBridgeConfig: {
                        filePath: issueFilePath,
                    },
                    agent,
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

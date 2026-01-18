/**
 * Example demonstrating the Claude CLI Agent with the trust workflow
 *
 * This example shows how to:
 * 1. Configure the Claude CLI agent (requires claude CLI to be installed)
 * 2. Use a markdown sourcer to load an issue
 * 3. Use the macOS user bridge for interaction
 * 4. Execute the full workflow with planning and implementation
 *
 * Prerequisites:
 * - Claude CLI must be installed and available in PATH
 * - Create a sample markdown file with an issue at ./fixtures/sample-issue.md
 *
 * Usage:
 *   pnpm exec tsx examples/workflow-with-claude-cli.ts
 */

import { config } from 'dotenv';
import { ClaudeCliAgent } from '../src/agents/index.js';
import { LocalMarkdownSourcer } from '../src/sourcers/index.js';
import { MacosUserBridge } from '../src/bridges/index.js';
import { runWorkflow } from '../src/workflow.js';

// Load environment variables
config();

async function main() {
    console.log('🚀 Starting workflow with Claude CLI Agent\n');

    // Create the Claude CLI agent
    const agent = new ClaudeCliAgent();

    // Create sourcer (using markdown for this example)
    const sourcer = new LocalMarkdownSourcer();

    // Create user bridge (macOS notifications)
    const userBridge = new MacosUserBridge();

    // Run the workflow
    await runWorkflow({
        sourcer,
        sourcerConfig: {
            filePath: './fixtures/sample-issue.md',
        },
        userBridge,
        userBridgeConfig: {},
        agent,
        agentConfig: {
            model: 'claude-sonnet-4-5-20250929',
            quiet: false,
        },
    });

    console.log('\n✅ Workflow completed!');
}

main().catch((error) => {
    console.error('❌ Workflow failed:', error);
    process.exit(1);
});

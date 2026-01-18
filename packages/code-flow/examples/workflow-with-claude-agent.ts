/**
 * Example demonstrating the Claude Agent with the trust workflow
 *
 * This example shows how to:
 * 1. Configure the Claude agent with API key and model
 * 2. Use a markdown sourcer to load an issue
 * 3. Use the macOS user bridge for interaction
 * 4. Execute the full workflow with planning and implementation
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - Create a sample markdown file with an issue at ./fixtures/sample-issue.md
 *
 * Usage:
 *   export ANTHROPIC_API_KEY=your-api-key-here
 *   pnpm exec tsx examples/workflow-with-claude-agent.ts
 */

import { config } from 'dotenv';
import { ClaudeSdkAgent } from '../src/agents/index.js';
import { LocalMarkdownSourcer } from '../src/sourcers/index.js';
import { MacosUserBridge } from '../src/bridges/index.js';
import { runWorkflow } from '../src/workflow.js';

// Load environment variables
config();

async function main() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.error('Error: ANTHROPIC_API_KEY environment variable is required');
        console.error('Set it with: export ANTHROPIC_API_KEY=your-api-key-here');
        process.exit(1);
    }

    console.log('🚀 Starting workflow with Claude Agent\n');

    // Create the Claude agent
    const agent = new ClaudeSdkAgent();

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

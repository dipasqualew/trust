import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { mkdir, rm, readFile, copyFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runWorkflow } from '../../workflow.js';
import { LocalMarkdownSourcer } from '../../sourcers/local-markdown.js';
import { MarkdownUserBridge } from '../../bridges/markdown-user-bridge.js';
import { GithubCopilotAgent } from '../../agents/github-copilot-agent.js';

const execFileAsync = promisify(execFile);

// Enable debug logging when DEBUG=true
const DEBUG = process.env.DEBUG === 'true';
const log = (...args: unknown[]) => {
    if (DEBUG) {
        console.log('[Copilot Integration Test]', ...args);
    }
};

/**
 * Creates a unique test directory for parallel test runs
 */
function createTestDir(): string {
    const testId = randomBytes(8).toString('hex');
    return join(process.cwd(), '.cache', 'test-runs', 'copilot-integration', testId);
}

describe('Copilot Agent Flow Integration Test', () => {
    const testDir = createTestDir();
    const fixturesDir = join(process.cwd(), 'src', 'tests', 'fixtures', 'agentic-flow');
    const issueFile = join(testDir, 'issue.md');
    const scriptFile = join(testDir, 'calculate.sh');
    const expectedOutputFile = join(fixturesDir, 'expected-output.txt');
    let agent: GithubCopilotAgent;

    beforeEach(async () => {
        log('Setting up test environment');
        log('Test directory:', testDir);

        // Create test directory
        await mkdir(testDir, { recursive: true });
        log('Created test directory');

        // Copy fixture files to test directory
        await copyFile(join(fixturesDir, 'issue.md'), issueFile);
        log('Copied issue.md');

        await copyFile(join(fixturesDir, 'calculate.sh'), scriptFile);
        log('Copied calculate.sh');

        // Make the script executable
        await chmod(scriptFile, 0o755);
        log('Made script executable');

        // Initialize agent
        agent = new GithubCopilotAgent();
        log('Initialized GithubCopilotAgent');
    });

    afterEach(async () => {
        log('Cleaning up test directory');
        // Clean up test directory
        await rm(testDir, { recursive: true, force: true });
        log('Test directory cleaned up');
    });

    afterAll(async () => {
        log('Cleaning up Copilot client');
        // Clean up the Copilot client
        if (agent) {
            await agent.cleanup();
        }
        log('Copilot client cleaned up');
    });

    it('should fix the buggy calculator script using GitHub Copilot agent', async () => {
        log('=== Starting Copilot integration test ===');

        // Verify the bug exists before fix
        log('Step 1: Verifying bug exists');
        const { stdout: buggyOutput } = await execFileAsync(scriptFile, ['5', '3']);
        log('Buggy script output:', buggyOutput.trim());
        expect(buggyOutput.trim()).toBe('53'); // String concatenation bug
        log('✓ Bug confirmed: output is "53" instead of "8"');

        // Initialize components
        log('\nStep 2: Initializing workflow components');
        const sourcer = new LocalMarkdownSourcer();
        const userBridge = new MarkdownUserBridge();
        log('✓ Components initialized');

        // Run the workflow - agent should read issue, plan, and implement fix
        log('\nStep 3: Running workflow with GitHub Copilot agent');
        log('Working directory:', testDir);
        log('Issue file:', issueFile);
        log('Calling runWorkflow...');

        await runWorkflow({
            sourcer,
            sourcerConfig: {
                sourceDir: testDir,
                fileName: 'issue.md',
            },
            userBridge,
            userBridgeConfig: {
                filePath: join(testDir, 'answer.md'),
            },
            agent,
            agentConfig: {
                model: 'claude-sonnet-4.5',
                quiet: false,
                workingDirectory: testDir,
            },
        });

        log('✓ Workflow completed');

        // Verify the fix works correctly
        log('\nStep 4: Verifying the fix');
        const { stdout: fixedOutput } = await execFileAsync(scriptFile, ['5', '3']);
        const expectedOutput = await readFile(expectedOutputFile, 'utf-8');

        log('Fixed script output:', fixedOutput.trim());
        log('Expected output:', expectedOutput.trim());
        expect(fixedOutput.trim()).toBe(expectedOutput.trim());
        log('✓ Fix verified: output is correct');

        // Test with different numbers to ensure it's truly fixed
        log('\nStep 5: Testing with additional inputs');
        const { stdout: test2 } = await execFileAsync(scriptFile, ['10', '7']);
        log('Test 10+7:', test2.trim());
        expect(test2.trim()).toBe('17');

        const { stdout: test3 } = await execFileAsync(scriptFile, ['100', '50']);
        log('Test 100+50:', test3.trim());
        expect(test3.trim()).toBe('150');
        log('✓ All additional tests passed');

        log('\n=== Copilot integration test completed successfully ===');
    }, 120000); // 2 minute timeout for Copilot execution
});

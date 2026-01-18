import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { runWorkflow } from '../workflow.js';
import { LocalMarkdownSourcer } from '../sourcers/local-markdown.js';
import { MarkdownUserBridge } from '../bridges/markdown-user-bridge.js';
import { VoidAgent } from '../agents/void-agent.js';
import { TestAgent } from './helpers/test-agent.js';

/**
 * Creates a unique test directory for parallel test runs
 */
function createTestDir(): string {
    const testId = randomBytes(8).toString('hex');
    return join(process.cwd(), '.cache', 'test-runs', testId);
}

describe('Workflow Integration Test', () => {
    const testDir = createTestDir();
    const issueFile = join(testDir, 'test-issue.md');

    beforeEach(async () => {
        // Create test directory
        await mkdir(testDir, { recursive: true });

        // Create a test issue file
        const issueContent = `# Test Issue

## Description
This is a test issue for integration testing.

## Requirements
- Requirement 1
- Requirement 2

## Technical Details
Some technical details here.
`;
        await writeFile(issueFile, issueContent, 'utf-8');
    });

    afterEach(async () => {
        // Clean up test directory
        await rm(testDir, { recursive: true, force: true });
    });

    it('should execute the complete workflow successfully', async () => {
        const sourcer = new LocalMarkdownSourcer();
        const userBridge = new MarkdownUserBridge();
        const agent = new VoidAgent();

        // Workflow should complete without errors
        await expect(
            runWorkflow({
                sourcer,
                sourcerConfig: {
                    sourceDir: testDir,
                    fileName: 'test-issue.md',
                },
                userBridge,
                userBridgeConfig: {
                    filePath: issueFile,
                },
                agent,
                agentConfig: {
                    quiet: true,
                },
            }),
        ).resolves.toBeUndefined();

        // Verify issue file still exists and is intact
        const content = await readFile(issueFile, 'utf-8');
        expect(content).toContain('# Test Issue');
    });

    it('should fetch issue content correctly', async () => {
        const sourcer = new LocalMarkdownSourcer();

        const issue = await sourcer.fetch({
            sourceDir: testDir,
            fileName: 'test-issue.md',
        });

        expect(issue.content).toContain('# Test Issue');
        expect(issue.content).toContain('## Description');
        expect(issue.content).toContain('This is a test issue for integration testing');
    });

    it('should handle workflow with no questions from agent', async () => {
        const sourcer = new LocalMarkdownSourcer();
        const userBridge = new MarkdownUserBridge();
        const agent = new VoidAgent();

        // VoidAgent returns no questions by default - workflow should complete without errors
        await expect(
            runWorkflow({
                sourcer,
                sourcerConfig: {
                    sourceDir: testDir,
                    fileName: 'test-issue.md',
                },
                userBridge,
                userBridgeConfig: {
                    filePath: issueFile,
                },
                agent,
                agentConfig: {
                    quiet: true,
                },
            }),
        ).resolves.toBeUndefined();
    });

    it('should create Q&A section when agent asks questions', async () => {
        const sourcer = new LocalMarkdownSourcer();
        const userBridge = new MarkdownUserBridge();

        // Ask a question
        await userBridge.ask(
            { question: 'What technology should we use?' },
            { filePath: issueFile },
        );

        // Read the file and verify Q&A section was added
        const content = await readFile(issueFile, 'utf-8');

        expect(content).toContain('## Q&A');
        expect(content).toContain('### What technology should we use?');
        expect(content).toContain('_Awaiting answer..._');
    });

    it('should handle agent questions with user answers in workflow', async () => {
        const sourcer = new LocalMarkdownSourcer();
        const userBridge = new MarkdownUserBridge();

        // Create an agent that asks questions
        const agent = new TestAgent(['What framework should we use?', 'Should we use TypeScript?']);

        // Start the workflow in the background (it will pause waiting for answers)
        const workflowPromise = runWorkflow({
            sourcer,
            sourcerConfig: {
                sourceDir: testDir,
                fileName: 'test-issue.md',
            },
            userBridge,
            userBridgeConfig: {
                filePath: issueFile,
                pollInterval: 100, // Fast polling for tests
            },
            agent,
            agentConfig: {
                quiet: true,
            },
        });

        // Wait a bit for questions to be written
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify questions were added to the file
        let content = await readFile(issueFile, 'utf-8');
        expect(content).toContain('## Q&A');
        expect(content).toContain('### What framework should we use?');

        // Simulate user answering the first question
        content = content.replace(
            '### What framework should we use?\n\n_Awaiting answer..._',
            '### What framework should we use?\n\nWe should use React for the frontend.',
        );
        await writeFile(issueFile, content, 'utf-8');

        // Wait a bit for the answer to be detected
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify second question was added
        content = await readFile(issueFile, 'utf-8');
        expect(content).toContain('### Should we use TypeScript?');

        // Simulate user answering the second question
        content = content.replace(
            '### Should we use TypeScript?\n\n_Awaiting answer..._',
            '### Should we use TypeScript?\n\nYes, TypeScript is preferred for type safety.',
        );
        await writeFile(issueFile, content, 'utf-8');

        // Wait for workflow to complete
        await workflowPromise;

        // Verify both answers are in the file
        const finalContent = await readFile(issueFile, 'utf-8');
        expect(finalContent).toContain('We should use React for the frontend.');
        expect(finalContent).toContain('Yes, TypeScript is preferred for type safety.');

        // Verify workflow completed successfully (by getting here without errors)
    });
});

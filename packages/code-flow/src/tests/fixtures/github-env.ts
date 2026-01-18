import { test as base, expect } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load environment variables from .env file in repo root
config({ path: resolve(process.cwd(), '../../.env') });

/**
 * GitHub environment variables for integration tests
 */
export interface GitHubTestContext {
    githubToken: string;
    githubIssueUrl: string;
}

/**
 * Extended test with GitHub environment variables
 */
export const test = base.extend<GitHubTestContext>({
    githubToken: async ({ }, use) => {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN environment variable is not set');
        }
        await use(token);
    },
    githubIssueUrl: async ({ }, use) => {
        const url = process.env.GITHUB_INTEGRATION_TEST_ISSUE_URL;
        if (!url) {
            throw new Error('GITHUB_INTEGRATION_TEST_ISSUE_URL environment variable is not set');
        }
        await use(url);
    },
});

export { expect };

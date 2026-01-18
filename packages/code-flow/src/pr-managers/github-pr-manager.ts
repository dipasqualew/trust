import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import type {
    PRManager,
    PRManagerConfig,
    PullRequest,
    PullRequestDetails,
    ReviewComment,
} from '../interfaces/index.js';

/**
 * Configuration for GitHubPRManager
 */
export interface GitHubPRManagerConfig extends PRManagerConfig {
    /** GitHub Personal Access Token for authentication */
    token: string;
}

/**
 * GitHubPRManager creates and manages pull requests on GitHub
 */
export class GitHubPRManager implements PRManager {
    async openPr(
        config: PRManagerConfig,
        title: string,
        body: string,
        sourceBranch?: string,
    ): Promise<PullRequest> {
        const githubConfig = config as GitHubPRManagerConfig;

        if (!githubConfig.token) {
            throw new Error('GitHubPRManager requires a token configuration');
        }

        // Get repository information from .git
        const { owner, repo } = this.getRepoInfo();

        // Get current branch if not provided
        const branch = sourceBranch || this.getCurrentBranch();

        const octokit = new Octokit({
            auth: githubConfig.token,
        });

        // Create pull request
        const { data: pr } = await octokit.rest.pulls.create({
            owner,
            repo,
            title,
            body,
            head: branch,
            base: 'main',
        });

        return {
            number: pr.number,
            url: pr.html_url,
        };
    }

    async getPRDetails(
        config: PRManagerConfig,
        prNumber: number,
    ): Promise<PullRequestDetails> {
        const githubConfig = config as GitHubPRManagerConfig;

        if (!githubConfig.token) {
            throw new Error('GitHubPRManager requires a token configuration');
        }

        // Get repository information from .git
        const { owner, repo } = this.getRepoInfo();

        const octokit = new Octokit({
            auth: githubConfig.token,
        });

        // Fetch PR details
        const { data: pr } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        // Fetch review comments
        const { data: comments } = await octokit.rest.pulls.listReviewComments({
            owner,
            repo,
            pull_number: prNumber,
        });

        // Determine state (including draft and merged)
        let state: 'open' | 'closed' | 'draft' | 'merged';
        if (pr.merged) {
            state = 'merged';
        } else if (pr.draft) {
            state = 'draft';
        } else if (pr.state === 'closed') {
            state = 'closed';
        } else {
            state = 'open';
        }

        // Format review comments
        const reviewComments: ReviewComment[] = comments.map((comment) => ({
            author: comment.user?.login || 'unknown',
            body: comment.body || '',
            path: comment.path,
            line: comment.line || undefined,
            createdAt: comment.created_at,
        }));

        return {
            number: pr.number,
            url: pr.html_url,
            state,
            title: pr.title,
            body: pr.body || '',
            reviewComments,
        };
    }

    /**
     * Gets repository owner and name from git remote
     */
    private getRepoInfo(): { owner: string; repo: string } {
        try {
            const remote = execSync('git config --get remote.origin.url', {
                encoding: 'utf-8',
            }).trim();

            // Parse GitHub URL (supports both HTTPS and SSH)
            // HTTPS: https://github.com/owner/repo.git
            // SSH: git@github.com:owner/repo.git
            const httpsMatch = remote.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
            const sshMatch = remote.match(/git@github\.com:([^\/]+)\/([^\/]+?)(\.git)?$/);

            const match = httpsMatch || sshMatch;

            if (!match) {
                throw new Error(`Unable to parse GitHub remote URL: ${remote}`);
            }

            return {
                owner: match[1],
                repo: match[2],
            };
        } catch (error) {
            throw new Error(
                `Failed to get repository information from git remote: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Gets the current git branch name
     */
    private getCurrentBranch(): string {
        try {
            const branch = execSync('git rev-parse --abbrev-ref HEAD', {
                encoding: 'utf-8',
            }).trim();

            if (!branch || branch === 'HEAD') {
                throw new Error('Not on a valid branch (detached HEAD state)');
            }

            return branch;
        } catch (error) {
            throw new Error(
                `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}

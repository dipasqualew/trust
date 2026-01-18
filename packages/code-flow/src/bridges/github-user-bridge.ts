import { Octokit } from '@octokit/rest';
import type { Answer, Question, UserBridge, UserBridgeConfig } from '../interfaces/index.js';

/**
 * Configuration for GitHubUserBridge
 */
export interface GitHubUserBridgeConfig extends UserBridgeConfig {
    /** GitHub Personal Access Token for authentication */
    token: string;
    /** Repository owner */
    owner: string;
    /** Repository name */
    repo: string;
    /** Issue number */
    issueNumber: number;
    /** Polling interval in milliseconds (default: 60000ms / 60s) */
    pollInterval?: number;
}

/**
 * GitHubUserBridge manages Q&A through GitHub issue comments
 * Questions are posted as comments
 * Answers are retrieved from new comments after the question was posted
 */
export class GitHubUserBridge implements UserBridge {
    private questionTimestamp: Date | null = null;

    async ask(question: Question, config: UserBridgeConfig): Promise<void> {
        const githubConfig = config as GitHubUserBridgeConfig;

        if (!githubConfig.token) {
            throw new Error('GitHubUserBridge requires a token configuration');
        }

        if (!githubConfig.owner || !githubConfig.repo || !githubConfig.issueNumber) {
            throw new Error('GitHubUserBridge requires owner, repo, and issueNumber configuration');
        }

        const octokit = new Octokit({
            auth: githubConfig.token,
        });

        // Post question as comment
        await octokit.rest.issues.createComment({
            owner: githubConfig.owner,
            repo: githubConfig.repo,
            issue_number: githubConfig.issueNumber,
            body: `**Question:** ${question.question}`,
        });

        // Track when the question was asked
        this.questionTimestamp = new Date();
    }

    async waitForAnswer(config: UserBridgeConfig): Promise<Answer> {
        const githubConfig = config as GitHubUserBridgeConfig;
        const pollInterval = githubConfig.pollInterval ?? 60000; // Default 60 seconds

        if (!githubConfig.token) {
            throw new Error('GitHubUserBridge requires a token configuration');
        }

        if (!githubConfig.owner || !githubConfig.repo || !githubConfig.issueNumber) {
            throw new Error('GitHubUserBridge requires owner, repo, and issueNumber configuration');
        }

        const octokit = new Octokit({
            auth: githubConfig.token,
        });

        // Poll for new comments
        while (true) {
            await this.sleep(pollInterval);

            const { data: comments } = await octokit.rest.issues.listComments({
                owner: githubConfig.owner,
                repo: githubConfig.repo,
                issue_number: githubConfig.issueNumber,
            });

            // Find comments created after the question was asked
            const newComments = comments.filter((comment) => {
                if (!this.questionTimestamp) {
                    return false;
                }
                const commentDate = new Date(comment.created_at);
                return commentDate > this.questionTimestamp;
            });

            // If there are new comments, return all of them concatenated
            if (newComments.length > 0) {
                const answer = newComments
                    .map((comment) => {
                        return `**@${comment.user?.login || 'unknown'}** commented on ${comment.created_at}:\n\n${comment.body}`;
                    })
                    .join('\n\n---\n\n');

                return { answer };
            }
        }
    }

    /**
     * Utility to sleep for a specified duration
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

import { Octokit } from '@octokit/rest';
import type { Issue, Sourcer, SourcerConfig } from '../interfaces/index.js';

/**
 * Configuration for GitHubSourcer
 */
export interface GitHubSourcerConfig extends SourcerConfig {
    /** GitHub issue URL (e.g., https://github.com/owner/repo/issues/123) */
    url: string;
    /** GitHub Personal Access Token for authentication */
    token: string;
}

/**
 * GitHubSourcer fetches issues and comments from GitHub
 */
export class GitHubSourcer implements Sourcer {
    async fetch(config: SourcerConfig): Promise<Issue> {
        const githubConfig = config as GitHubSourcerConfig;

        if (!githubConfig.url) {
            throw new Error('GitHubSourcer requires a url configuration');
        }

        if (!githubConfig.token) {
            throw new Error('GitHubSourcer requires a token configuration');
        }

        const { owner, repo, issueNumber } = this.parseGitHubUrl(githubConfig.url);

        const octokit = new Octokit({
            auth: githubConfig.token,
        });

        // Fetch issue
        const { data: issue } = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
        });

        // Fetch comments
        const { data: comments } = await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: issueNumber,
        });

        // Format as markdown
        const content = this.formatAsMarkdown(issue, comments);

        return {
            content,
        };
    }

    /**
     * Parses GitHub issue URL to extract owner, repo, and issue number
     */
    private parseGitHubUrl(url: string): { owner: string; repo: string; issueNumber: number } {
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);

        if (!match) {
            throw new Error(`Invalid GitHub issue URL: ${url}`);
        }

        return {
            owner: match[1],
            repo: match[2],
            issueNumber: parseInt(match[3], 10),
        };
    }

    /**
     * Formats issue and comments as markdown
     */
    private formatAsMarkdown(
        issue: any,
        comments: any[],
    ): string {
        let markdown = `# ${issue.title}\n\n`;
        markdown += `**Author:** @${issue.user.login}\n`;
        markdown += `**Created:** ${issue.created_at}\n`;
        markdown += `**URL:** ${issue.html_url}\n\n`;
        markdown += `---\n\n`;
        markdown += `${issue.body || '_No description provided_'}\n\n`;

        if (comments.length > 0) {
            markdown += `## Comments\n\n`;

            for (const comment of comments) {
                markdown += `---\n\n`;
                markdown += `**@${comment.user.login}** commented on ${comment.created_at}:\n\n`;
                markdown += `${comment.body}\n\n`;
            }
        }

        return markdown;
    }
}

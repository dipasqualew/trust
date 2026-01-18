import { describe, afterAll } from 'vitest';
import { Octokit } from '@octokit/rest';
import { test, expect } from './fixtures/github-env.js';
import { GitHubSourcer } from '../sourcers/github-sourcer.js';
import { GitHubUserBridge } from '../bridges/github-user-bridge.js';
import type { Answer } from '../interfaces/index.js';

describe('GitHub Integration Tests', () => {
    let octokit: Octokit;
    let owner: string;
    let repo: string;
    let issueNumber: number;
    let testCommentIds: number[] = [];
    let githubToken: string;
    let githubIssueUrl: string;

    test('should initialize test context', ({ githubToken: token, githubIssueUrl: url }) => {
        githubToken = token;
        githubIssueUrl = url;

        // Initialize Octokit
        octokit = new Octokit({ auth: githubToken });

        // Parse issue URL to extract owner, repo, and issue number
        const match = githubIssueUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
        if (!match) {
            throw new Error(`Invalid GitHub issue URL: ${githubIssueUrl}`);
        }
        owner = match[1];
        repo = match[2];
        issueNumber = parseInt(match[3], 10);

        expect(owner).toBeDefined();
        expect(repo).toBeDefined();
        expect(issueNumber).toBeGreaterThan(0);
    });

    afterAll(async () => {
        // Clean up all test comments
        for (const commentId of testCommentIds) {
            try {
                await octokit.rest.issues.deleteComment({
                    owner,
                    repo,
                    comment_id: commentId,
                });
            } catch (error) {
                console.error(`Failed to delete comment ${commentId}:`, error);
            }
        }
    });

    test('should fetch issue and comments from GitHub', async ({ githubToken, githubIssueUrl }) => {
        const sourcer = new GitHubSourcer();

        const issue = await sourcer.fetch({
            url: githubIssueUrl,
            token: githubToken,
        });

        // Verify the issue has content
        expect(issue.content).toBeDefined();
        expect(issue.content.length).toBeGreaterThan(0);

        // Verify markdown format includes title
        expect(issue.content).toContain('# ');

        // Verify it includes author and URL metadata
        expect(issue.content).toContain('**Author:**');
        expect(issue.content).toContain('**URL:**');
        expect(issue.content).toContain(githubIssueUrl);

        console.log('Fetched issue content length:', issue.content.length);
    });

    test('should post question as comment and read answer comments', async ({ githubToken }) => {
        const bridge = new GitHubUserBridge();

        const question = {
            question: `Test question from integration test at ${new Date().toISOString()}`,
        };

        // Post the question
        await bridge.ask(question, {
            token: githubToken,
            owner,
            repo,
            issueNumber,
        });

        console.log('Posted question:', question.question);

        // Fetch comments to verify question was posted and track for cleanup
        const { data: commentsAfterQuestion } = await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: issueNumber,
        });

        const questionComment = commentsAfterQuestion.find((comment) =>
            comment.body?.includes(question.question),
        );

        expect(questionComment).toBeDefined();
        expect(questionComment?.body).toContain('**Question:**');

        // Track comment for cleanup
        if (questionComment) {
            testCommentIds.push(questionComment.id);
        }

        // Post a mock answer comment
        const answerText = 'This is an automated test answer. This comment will be deleted.';
        const { data: answerComment } = await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: issueNumber,
            body: answerText,
        });

        // Track answer comment for cleanup
        testCommentIds.push(answerComment.id);

        console.log('Posted answer comment:', answerComment.id);

        // Wait for answer with a shorter poll interval for testing (5 seconds)
        const answerPromise = bridge.waitForAnswer({
            token: githubToken,
            owner,
            repo,
            issueNumber,
            pollInterval: 5000,
        });

        // Set a timeout to avoid waiting too long
        const timeoutPromise = new Promise<Answer>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout waiting for answer')), 30000),
        );

        const answer = await Promise.race([answerPromise, timeoutPromise]);

        // Verify the answer
        expect(answer).toBeDefined();
        expect(answer.answer).toContain(answerText);
        console.log('Received answer:', answer.answer);
    }, { timeout: 60000 }); // Increase timeout for this test since it polls
});

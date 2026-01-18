/**
 * Represents a pull request that was created or fetched
 */
export interface PullRequest {
    /** The PR number */
    number: number;
    /** The URL to the pull request */
    url: string;
}

/**
 * Represents the detailed state of a pull request
 */
export interface PullRequestDetails {
    /** The PR number */
    number: number;
    /** The URL to the pull request */
    url: string;
    /** The current state of the PR */
    state: 'open' | 'closed' | 'draft' | 'merged';
    /** The PR title */
    title: string;
    /** The PR body/description */
    body: string;
    /** Review comments on the PR */
    reviewComments: ReviewComment[];
}

/**
 * Represents a review comment on a pull request
 */
export interface ReviewComment {
    /** The author of the comment */
    author: string;
    /** The comment body */
    body: string;
    /** The file path the comment is on (if applicable) */
    path?: string;
    /** The line number the comment is on (if applicable) */
    line?: number;
    /** The timestamp of the comment */
    createdAt: string;
}

/**
 * Configuration for a PRManager implementation
 */
export interface PRManagerConfig {
    [key: string]: unknown;
}

/**
 * PRManager is responsible for creating and managing pull requests
 */
export interface PRManager {
    /**
     * Opens a new pull request
     * @param config - Configuration for the PR manager
     * @param title - The title of the pull request
     * @param body - The body/description of the pull request
     * @param sourceBranch - The source branch (optional, defaults to current branch)
     * @returns Promise resolving to a PullRequest object with number and URL
     */
    openPr(
        config: PRManagerConfig,
        title: string,
        body: string,
        sourceBranch?: string,
    ): Promise<PullRequest>;

    /**
     * Gets detailed information about a pull request
     * @param config - Configuration for the PR manager
     * @param prNumber - The pull request number
     * @returns Promise resolving to detailed PR information
     */
    getPRDetails(
        config: PRManagerConfig,
        prNumber: number,
    ): Promise<PullRequestDetails>;
}

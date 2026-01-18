/**
 * Represents an issue fetched from a source (e.g., GitHub, Jira, local file)
 */
export interface Issue {
    /** The full content/description of the issue */
    content: string;
}

/**
 * Configuration for a Sourcer implementation
 */
export interface SourcerConfig {
    [key: string]: unknown;
}

/**
 * Sourcer is responsible for fetching issue information from various sources
 */
export interface Sourcer {
    /**
     * Fetches issue information from the configured source
     * @returns Promise resolving to an Issue object
     */
    fetch(config: SourcerConfig): Promise<Issue>;
}

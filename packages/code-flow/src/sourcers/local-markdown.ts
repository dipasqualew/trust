import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Issue, Sourcer, SourcerConfig } from '../interfaces/index.js';

/**
 * Configuration for LocalMarkdownSourcer
 */
export interface LocalMarkdownSourcerConfig extends SourcerConfig {
    /** Directory to scan for markdown files */
    sourceDir: string;
    /** Optional specific file name to look for */
    fileName?: string;
}

/**
 * LocalMarkdownSourcer fetches issues from local markdown files
 */
export class LocalMarkdownSourcer implements Sourcer {
    async fetch(config: SourcerConfig): Promise<Issue> {
        const localConfig = config as LocalMarkdownSourcerConfig;

        if (!localConfig.sourceDir) {
            throw new Error('LocalMarkdownSourcer requires a sourceDir configuration');
        }

        const filePath = localConfig.fileName
            ? join(localConfig.sourceDir, localConfig.fileName)
            : await this.findFirstMarkdownFile(localConfig.sourceDir);

        const content = await readFile(filePath, 'utf-8');

        return {
            content,
        };
    }

    /**
     * Finds the first markdown file in the directory
     */
    private async findFirstMarkdownFile(dir: string): Promise<string> {
        const files = await readdir(dir);
        const markdownFile = files.find((file) => file.endsWith('.md'));

        if (!markdownFile) {
            throw new Error(`No markdown files found in ${dir}`);
        }

        return join(dir, markdownFile);
    }
}

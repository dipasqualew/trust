import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration structure for trust
 * Top-level keys are module names (e.g., "sourcer", "userBridge", "agent")
 * Each module has an "active" field and module-specific config
 */
export interface TrustConfig {
    [moduleName: string]: {
        active: string;
        config: Record<string, unknown>;
    };
}

/**
 * ConfigManager handles reading and writing configuration
 * to .cache/trust-config.json at the monorepo root
 */
export class ConfigManager {
    private configPath: string;

    constructor(rootPath?: string) {
        // Find monorepo root (3 levels up from src/config.ts -> src -> code-flow -> packages -> root)
        const root = rootPath ?? join(__dirname, '../../..');
        this.configPath = join(root, '.cache', 'trust-config.json');
    }

    /**
     * Reads the configuration file
     * Returns empty object if file doesn't exist
     */
    async read(): Promise<TrustConfig> {
        try {
            const content = await readFile(this.configPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            // File doesn't exist or is invalid, return empty config
            return {};
        }
    }

    /**
     * Writes the configuration file
     * Creates the .cache directory if it doesn't exist
     */
    async write(config: TrustConfig): Promise<void> {
        // Ensure .cache directory exists
        const cacheDir = dirname(this.configPath);
        await mkdir(cacheDir, { recursive: true });

        await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    }

    /**
     * Gets configuration for a specific module
     */
    async getModule(moduleName: string): Promise<TrustConfig[string] | undefined> {
        const config = await this.read();
        return config[moduleName];
    }

    /**
     * Sets configuration for a specific module
     */
    async setModule(
        moduleName: string,
        moduleConfig: { active: string; config: Record<string, unknown> },
    ): Promise<void> {
        const config = await this.read();
        config[moduleName] = moduleConfig;
        await this.write(config);
    }
}

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { accessSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProfileConfig } from './config-wizard/component-factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Finds the git repository root by looking for .git directory.
 * Walks up the directory tree from the starting path.
 */
function findGitRoot(startPath: string): string {
    let currentPath = resolve(startPath);
    const root = sep; // '/' on Unix, 'C:\' on Windows

    while (currentPath !== root) {
        try {
            const gitPath = join(currentPath, '.git');
            accessSync(gitPath);
            return currentPath;
        } catch {
            // .git not found, go up one level
            const parentPath = dirname(currentPath);
            if (parentPath === currentPath) {
                // We've reached the root without finding .git
                break;
            }
            currentPath = parentPath;
        }
    }

    throw new Error('Not in a git repository. Trust can only be executed inside a git repository.');
}

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
 * Profile-based configuration structure
 */
export interface ProfilesConfig {
    defaultProfile?: string;
    profiles: {
        [profileName: string]: ProfileConfig;
    };
}

/**
 * ConfigManager handles reading and writing configuration
 * to .trust/config.json at the repository root
 */
export class ConfigManager {
    private readonly configPath: string;
    private readonly gitignorePath: string;
    private readonly gitRoot: string;

    constructor(rootPath?: string) {
        // Find git root immediately at construction
        this.gitRoot = rootPath ?? findGitRoot(process.cwd());
        this.configPath = join(this.gitRoot, '.trust', 'config.json');
        this.gitignorePath = join(this.gitRoot, '.trust', '.gitignore');
    }

    /**
     * Ensures .trust directory exists and has a .gitignore
     */
    private async ensureTrustDirectory(): Promise<void> {
        const trustDir = dirname(this.configPath);
        await mkdir(trustDir, { recursive: true });

        // Create .gitignore if it doesn't exist
        try {
            await readFile(this.gitignorePath, 'utf-8');
        } catch {
            // File doesn't exist, create it
            await writeFile(this.gitignorePath, 'config.json\n', 'utf-8');
        }
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
     * Creates the .trust directory if it doesn't exist
     */
    async write(config: TrustConfig): Promise<void> {
        await this.ensureTrustDirectory();
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

    /**
     * Reads the profiles configuration
     */
    async readProfiles(): Promise<ProfilesConfig> {
        try {
            const content = await readFile(this.configPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            // File doesn't exist or is invalid, return empty profiles
            return { profiles: {} };
        }
    }

    /**
     * Writes the profiles configuration
     */
    async writeProfiles(config: ProfilesConfig): Promise<void> {
        await this.ensureTrustDirectory();
        await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    }

    /**
     * Lists all available profiles
     */
    async listProfiles(): Promise<string[]> {
        const config = await this.readProfiles();
        return Object.keys(config.profiles);
    }

    /**
     * Gets a specific profile by name
     */
    async getProfile(profileName: string): Promise<ProfileConfig | undefined> {
        const config = await this.readProfiles();
        return config.profiles[profileName];
    }

    /**
     * Creates or updates a profile
     */
    async saveProfile(profileName: string, profile: ProfileConfig): Promise<void> {
        const config = await this.readProfiles();
        config.profiles[profileName] = profile;
        await this.writeProfiles(config);
    }

    /**
     * Deletes a profile
     */
    async deleteProfile(profileName: string): Promise<void> {
        const config = await this.readProfiles();
        delete config.profiles[profileName];

        // If this was the default profile, clear the default
        if (config.defaultProfile === profileName) {
            delete config.defaultProfile;
        }

        await this.writeProfiles(config);
    }

    /**
     * Gets the default profile name
     */
    async getDefaultProfile(): Promise<string | undefined> {
        const config = await this.readProfiles();
        return config.defaultProfile;
    }

    /**
     * Sets the default profile
     */
    async setDefaultProfile(profileName: string): Promise<void> {
        const config = await this.readProfiles();

        // Verify the profile exists
        if (!config.profiles[profileName]) {
            throw new Error(`Profile "${profileName}" does not exist`);
        }

        config.defaultProfile = profileName;
        await this.writeProfiles(config);
    }

    /**
     * Checks if any profiles exist
     */
    async hasProfiles(): Promise<boolean> {
        const profiles = await this.listProfiles();
        return profiles.length > 0;
    }
}

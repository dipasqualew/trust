# Configuration Wizard

The Trust CLI now includes an interactive configuration wizard that makes it easy to set up and manage profiles for different use cases.

## Quick Start

When you run Trust for the first time, the wizard will automatically launch to help you create your first profile:

```bash
pnpm trust run
```

## Manual Configuration

You can also manually configure profiles at any time:

```bash
pnpm trust configure
```

## What is a Profile?

A **profile** is a saved configuration that specifies:

1. **Sourcer** - Where issues come from (GitHub, local markdown files)
2. **User Bridge** - How to communicate with users (GitHub comments, markdown files, macOS dialogs)
3. **Agent** - Which AI agent to use (Claude CLI, Claude SDK, GitHub Copilot, or Void/testing)

Each component has its own configuration options (API tokens, file paths, etc.).

## Available Components

### Sourcers

- **LocalMarkdownSourcer** - Read issues from local markdown files
  - Required: `sourceDir` (directory path)
  - Optional: `fileName` (specific file name)

- **GitHubSourcer** - Fetch issues from GitHub
  - Required: `issueUrl` (full GitHub issue URL)
  - Required: `token` (GitHub Personal Access Token)

### User Bridges

- **MarkdownUserBridge** - Q&A via markdown file
  - Required: `filePath` (path to markdown file)
  - Optional: `pollInterval` (milliseconds, default 60000)

- **GitHubUserBridge** - Q&A via GitHub comments
  - Required: `token` (GitHub Personal Access Token)
  - Required: `owner` (repository owner)
  - Required: `repo` (repository name)
  - Required: `issueNumber` (issue number)
  - Optional: `pollInterval` (milliseconds, default 60000)

- **MacosUserBridge** - Native macOS dialog boxes (macOS only)
  - No configuration required

### Agents

- **ClaudeCliAgent** - Uses `claude` CLI tool (stateless)
  - Required: `modelName` (e.g., `claude-sonnet-4-20250514`)
  - Optional: `workingDirectory` (execution directory)
  - Optional: `quiet` (suppress logging)
  - **Requires**: `claude` CLI tool installed

- **ClaudeSdkAgent** - Uses Anthropic SDK (supports sessions)
  - Required: `modelName` (e.g., `claude-sonnet-4-20250514`)
  - Optional: `quiet` (suppress logging)
  - **Requires**: `ANTHROPIC_API_KEY` environment variable

- **GithubCopilotAgent** - Uses GitHub Copilot SDK (supports sessions)
  - Required: `modelName` (e.g., `gpt-4o`)
  - Optional: `workingDirectory` (client directory)
  - Optional: `quiet` (suppress logging)

- **VoidAgent** - Mock agent for testing
  - Optional: `quiet` (suppress logging)
  - **Note**: Does not perform actual work

## Using Profiles

### Default Profile

The first profile you create becomes the default profile. When you run:

```bash
pnpm trust run
```

It uses the default profile automatically.

### Using a Specific Profile

To use a non-default profile:

```bash
pnpm trust run --profile production
```

### Managing Profiles

1. **Create/Edit a Profile**: Run `pnpm trust configure`
2. **Select Profile**: Choose existing profile or create new one
3. **Configure Components**: Answer questions for sourcer, bridge, and agent
4. **Set as Default**: Optionally set the profile as default

## Configuration Storage

Profiles are stored in `.trust/config.json` in your repository root:

```json
{
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "sourcer": {
        "type": "LocalMarkdownSourcer",
        "config": {
          "sourceDir": "./issues"
        }
      },
      "bridge": {
        "type": "MarkdownUserBridge",
        "config": {
          "filePath": "./issues/qa.md"
        }
      },
      "agent": {
        "type": "VoidAgent",
        "config": {
          "quiet": false
        }
      }
    }
  }
}
```

**Security Note**: The `.trust/` directory includes a `.gitignore` file that excludes `config.json` to prevent committing sensitive data like API tokens. Consider using environment variables for tokens in shared repositories.

## Validation

The wizard validates your selections:

- ✅ Platform requirements (e.g., MacosUserBridge only on macOS)
- ✅ CLI tool availability (e.g., `claude` binary for ClaudeCliAgent)
- ✅ Environment variables (e.g., `ANTHROPIC_API_KEY` for ClaudeSdkAgent)
- ✅ Configuration format (URLs, file paths, etc.)

If validation fails, you'll see helpful error messages with instructions to fix the issues.

## Architecture

The wizard is designed with separation of concerns to support future webapp migration:

- **Flow Model** (`flow-model.ts`) - Defines questions and flow logic (renderer-agnostic)
- **Component Registry** (`component-registry.ts`) - Metadata for all components
- **Component Factory** (`component-factory.ts`) - Instantiates components from config
- **Terminal Renderer** (`terminal-renderer.ts`) - Renders questions using inquirer
- **Wizard Orchestrator** (`wizard.ts`) - Coordinates the entire flow

The flow model can be reused with different renderers (e.g., React components for a web UI).

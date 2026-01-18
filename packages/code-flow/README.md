# @with-trust/code-flow

Core workflow engine for the Trust agentic coding system.

## Overview

`code-flow` implements an agentic workflow that:

1. **Fetches** issue information from configurable sources (GitHub, Jira, local files, etc.)
2. **Plans** the solution using an LLM agent
3. **Investigates** the codebase and asks clarifying questions
4. **Waits** for user answers (via configurable bridges)
5. **Implements** the code changes
6. **Reports** implementation results
7. **Opens** a pull request with the changes

## Architecture

The system is built around three core concepts with pluggable implementations:

### Sourcer

Responsible for fetching issue information from various sources.

**Interface**: `Sourcer`
**Implementations**:

- `LocalMarkdownSourcer` - Reads issues from local markdown files
- `GitHubSourcer` - Fetches issues and comments from GitHub

### UserBridge

Facilitates communication with users during planning/coding.

**Interface**: `UserBridge`
**Implementations**:

- `MarkdownUserBridge` - Manages Q&A through markdown file sections
- `GitHubUserBridge` - Manages Q&A through GitHub issue comments

### LLMAgent

Handles planning and implementation phases.

**Interface**: `LLMAgent`
**Implementations**:

- `VoidAgent` - Mock implementation for testing (logs method calls)

## Installation

```bash
pnpm install @with-trust/code-flow
```

## CLI Usage

### Run Workflow

```bash
trust run --source-dir ./issues --file-name my-issue.md
```

**Options**:

- `--source-dir, -s` (required) - Directory containing issue markdown files
- `--file-name, -f` - Specific markdown file to process
- `--issue-file, -i` - Markdown file to use for Q&A
- `--config-path, -c` - Path to config directory (defaults to monorepo root)

### Manage Configuration

```bash
# Show current configuration
trust config show
```

## Programmatic Usage

### Using Local Markdown Sources

```typescript
import {
    runWorkflow,
    LocalMarkdownSourcer,
    MarkdownUserBridge,
    VoidAgent,
} from '@with-trust/code-flow';

const sourcer = new LocalMarkdownSourcer();
const userBridge = new MarkdownUserBridge();
const agent = new VoidAgent();

await runWorkflow({
    sourcer,
    sourcerConfig: {
        sourceDir: './issues',
        fileName: 'my-issue.md',
    },
    userBridge,
    userBridgeConfig: {
        filePath: './issues/my-issue.md',
    },
    agent,
});
```

### Using GitHub Integration

```typescript
import {
    runWorkflow,
    GitHubSourcer,
    GitHubUserBridge,
    VoidAgent,
} from '@with-trust/code-flow';

const sourcer = new GitHubSourcer();
const userBridge = new GitHubUserBridge();
const agent = new VoidAgent();

await runWorkflow({
    sourcer,
    sourcerConfig: {
        url: 'https://github.com/owner/repo/issues/123',
        token: process.env.GITHUB_TOKEN,
    },
    userBridge,
    userBridgeConfig: {
        token: process.env.GITHUB_TOKEN,
        owner: 'owner',
        repo: 'repo',
        issueNumber: 123,
        pollInterval: 60000, // Optional: defaults to 60s
    },
    agent,
});
```

## Configuration

Configuration is stored in `.cache/trust-config.json` at the monorepo root.

Structure:

```json
{
    "sourcer": {
        "active": "local-markdown",
        "config": {
            "sourceDir": "./issues"
        }
    },
    "userBridge": {
        "active": "markdown",
        "config": {
            "filePath": "./issues/current.md",
            "pollInterval": 60000
        }
    },
    "agent": {
        "active": "void",
        "config": {}
    }
}
```

## Issue Format

Issues are defined in markdown files:

```markdown
# Issue Title

## Description
Detailed description of the issue

## Requirements
- Requirement 1
- Requirement 2

## Q&A

### What technology stack should we use?

_Awaiting answer..._
```

### Q&A Format

When the agent has questions, they're added under `## Q&A` as:

```markdown
### [Question text here]

_Awaiting answer..._
```

Users replace `_Awaiting answer..._` with their response. The system polls for changes every 60 seconds (configurable).

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test

# Test watch mode
pnpm test:watch
```

### Running GitHub Integration Tests

GitHub integration tests require environment variables to be set:

1. Copy `.env.example` to `.env` in the repo root:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your GitHub credentials:

   ```bash
   GITHUB_TOKEN=your_github_personal_access_token
   GITHUB_INTEGRATION_TEST_ISSUE_URL=https://github.com/owner/repo/issues/123
   ```

3. Run the tests:

   ```bash
   pnpm test
   ```

**Note**: The GitHub integration tests will:

- Fetch the specified issue and its comments
- Post test comments to the issue
- Automatically clean up all test comments after completion

## Extending

### Create a Custom Sourcer

```typescript
import type { Sourcer, SourcerConfig, Issue } from '@with-trust/code-flow';

export class GitHubSourcer implements Sourcer {
    async fetch(config: SourcerConfig): Promise<Issue> {
        // Fetch from GitHub API
        const response = await fetch(`https://api.github.com/...`);
        const data = await response.json();

        return {
            content: data.body,
        };
    }
}
```

### Create a Custom UserBridge

```typescript
import type { UserBridge, UserBridgeConfig, Question, Answer } from '@with-trust/code-flow';

export class SlackUserBridge implements UserBridge {
    async ask(question: Question, config: UserBridgeConfig): Promise<void> {
        // Post question to Slack
    }

    async waitForAnswer(config: UserBridgeConfig): Promise<Answer> {
        // Poll Slack for response
        return { answer: '...' };
    }
}
```

### Create a Custom LLMAgent

```typescript
import type { LLMAgent, Issue, Plan, Implementation } from '@with-trust/code-flow';

export class ClaudeAgent implements LLMAgent {
    async plan(issue: Issue): Promise<Plan> {
        // Call Claude API to create plan
        return {
            description: '...',
            questions: ['...'],
        };
    }

    async implement(issue: Issue, plan: Plan): Promise<Implementation> {
        // Call Claude API to implement
        return {
            description: '...',
            success: true,
        };
    }
}
```

## License

See root LICENSE file.

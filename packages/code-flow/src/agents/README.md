# Claude Agents

Two implementations of the `LLMAgent` interface are available:

1. **ClaudeSdkAgent**: Uses Anthropic's Claude Agent SDK v2
2. **ClaudeCliAgent**: Uses the Claude CLI via child_process

Both provide autonomous planning and implementation capabilities using Claude's advanced reasoning.

## ClaudeSdkAgent

Uses the official Claude Agent SDK v2 with full session management support.

### Features

- **Plan Mode**: Creates structured plans with optional questions for clarification
- **Session Management**: Maintains conversation context across multiple interactions using session IDs
- **Question/Answer Flow**: Collects user feedback and refines plans iteratively
- **Implementation Mode**: Executes plans with full tool access
- **Token Tracking**: Logs input/output token usage for cost monitoring

### Configuration

1. **Environment Variable**: `ANTHROPIC_API_KEY` must be set
2. **Config Object**:
   - `model`: Claude model to use (e.g., `'claude-sonnet-4-5-20250929'`)
   - `quiet` (optional): Suppress logging output

### Usage Example

```typescript
import { ClaudeSdkAgent } from '@with-trust/code-flow';

const agent = new ClaudeSdkAgent();

// Set API key in environment
process.env.ANTHROPIC_API_KEY = 'your-api-key';

// Create a plan
const plan = await agent.plan(issue, undefined, {
  model: 'claude-sonnet-4-5-20250929',
  quiet: false
});

// If plan has questions, collect answers and refine
if (plan.questions && plan.questions.length > 0) {
  const answers = [
    { question: plan.questions[0], answer: 'Answer 1' },
    { question: plan.questions[1], answer: 'Answer 2' }
  ];

  const refinedPlan = await agent.plan(issue, {
    answers,
    sessionId: plan.sessionId,
    originalIssue: issue
  }, {
    model: 'claude-sonnet-4-5-20250929'
  });
}

// Implement the plan
const implementation = await agent.implement(issue, plan, undefined, {
  model: 'claude-sonnet-4-5-20250929'
});
```

### With Workflow

```typescript
import { ClaudeSdkAgent } from '@with-trust/code-flow';
import { runWorkflow } from '@with-trust/code-flow';

await runWorkflow({
  sourcer: new LocalMarkdownSourcer(),
  sourcerConfig: { filePath: './issue.md' },
  userBridge: new MacosUserBridge(),
  userBridgeConfig: {},
  agent: new ClaudeSdkAgent(),
  agentConfig: {
    model: 'claude-sonnet-4-5-20250929',
    quiet: false
  }
});
```

### How It Works

**Planning Phase:**
1. Agent receives the issue content
2. Analyzes the problem and creates a plan
3. Returns plan as JSON with:
   - `description`: Overview of the approach
   - `questions`: Array of clarifying questions (if needed)
   - `sessionId`: For continuing the conversation

If questions are present:
1. Workflow collects answers from user
2. Agent resumes session with answers
3. Refines plan based on new information
4. Repeats until no more questions

**Implementation Phase:**
1. New session created with issue + plan context
2. Agent executes the plan with full tool access
3. Returns implementation result with:
   - `description`: What was done
   - `success`: Whether it succeeded

### Session Management

Sessions are automatically managed:
- **New Plan**: Creates fresh session
- **Refinement**: Resumes existing session with `sessionId`
- **Implementation**: New session (separate from planning)

### Example

See [examples/workflow-with-claude-agent.ts](../../examples/workflow-with-claude-agent.ts)

```bash
export ANTHROPIC_API_KEY=your-api-key
pnpm exec tsx examples/workflow-with-claude-agent.ts
```

---

## ClaudeCliAgent

Uses the Claude CLI tool via `child_process`. Suitable when you have Claude CLI installed but don't want to use the SDK.

### Features

- **Plan Mode**: Creates structured plans with optional questions
- **Question/Answer Flow**: Collects feedback and refines plans
- **Implementation Mode**: Executes plans with full permissions
- **Token Tracking**: Logs token usage from CLI output
- **No Session Management**: CLI doesn't support session resumption (known bug)

### Prerequisites

Claude CLI must be installed and available in your PATH:
```bash
which claude  # Should return the path to claude executable
```

### Configuration

**Config Object:**
- `model`: Claude model to use (e.g., `'claude-sonnet-4-5-20250929'`)
- `quiet` (optional): Suppress logging output

No API key needed in environment - Claude CLI handles authentication separately.

### Usage Example

```typescript
import { ClaudeCliAgent } from '@with-trust/code-flow';

const agent = new ClaudeCliAgent();

// Create a plan
const plan = await agent.plan(issue, undefined, {
  model: 'claude-sonnet-4-5-20250929',
  quiet: false
});

// If plan has questions, collect answers and refine
if (plan.questions && plan.questions.length > 0) {
  const answers = [
    { question: plan.questions[0], answer: 'Answer 1' },
    { question: plan.questions[1], answer: 'Answer 2' }
  ];

  // Note: originalIssue is passed because CLI can't resume sessions
  const refinedPlan = await agent.plan(issue, {
    answers,
    originalIssue: issue
  }, {
    model: 'claude-sonnet-4-5-20250929'
  });
}

// Implement the plan
const implementation = await agent.implement(issue, plan, undefined, {
  model: 'claude-sonnet-4-5-20250929'
});
```

### With Workflow

```typescript
import { ClaudeCliAgent } from '@with-trust/code-flow';
import { runWorkflow } from '@with-trust/code-flow';

await runWorkflow({
  sourcer: new LocalMarkdownSourcer(),
  sourcerConfig: { filePath: './issue.md' },
  userBridge: new MacosUserBridge(),
  userBridgeConfig: {},
  agent: new ClaudeCliAgent(),
  agentConfig: {
    model: 'claude-sonnet-4-5-20250929',
    quiet: false
  }
});
```

### How It Works

**Planning Phase:**
1. Constructs prompt with issue content
2. Executes: `claude --permissions bypass -p --output-format json "$prompt"`
3. Parses JSON response for plan and questions

**Refinement (when questions exist):**
1. Since CLI can't resume sessions, creates new prompt with:
   - Original issue content
   - Q&A section with all questions and answers
2. Executes CLI again with combined context
3. Agent provides refined plan

**Implementation Phase:**
1. Constructs prompt with issue + plan
2. Executes CLI with full permissions granted
3. Returns implementation description

### CLI Command Used

```bash
claude --permissions bypass -p --output-format json "$prompt"
```

- `--permissions bypass`: Grants all permissions without prompting
- `-p`: Plan mode flag
- `--output-format json`: Returns structured JSON output

### Differences from SDK Agent

| Feature | ClaudeSdkAgent | ClaudeCliAgent |
|---------|----------------|----------------|
| Session Resumption | ✅ Yes | ❌ No (CLI bug) |
| Authentication | `ANTHROPIC_API_KEY` env var | Claude CLI auth |
| Dependencies | Requires `@anthropic-ai/claude-agent-sdk` | Requires `claude` in PATH |
| Context Passing | Session-based | Reconstructed per call |
| Performance | Faster (persistent session) | Slower (new process each time) |

### Example

See [examples/workflow-with-claude-cli.ts](../../examples/workflow-with-claude-cli.ts)

```bash
pnpm exec tsx examples/workflow-with-claude-cli.ts
```

---

## Choosing Between Agents

**Use ClaudeSdkAgent when:**
- You have `ANTHROPIC_API_KEY`
- You want persistent sessions (better context)
- You need faster execution
- Working in CI/CD or automated environments

**Use ClaudeCliAgent when:**
- Claude CLI is already installed and configured
- You prefer CLI-based tooling
- SDK dependencies are not desired
- Working locally with CLI authentication

Both agents follow the same `LLMAgent` interface and can be swapped interchangeably in workflows.

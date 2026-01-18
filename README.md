# trust

An AI coding agent that helps teams develop the confidence to delegate.

## The problem

Most AI coding tools optimize for shipping code faster. But speed isn't the bottleneck for most teams—trust is.

Before any organization can deploy unsupervised agents, someone has to answer: *what would it take for me to trust an agent to do this without human review?* That question is personal, domain-specific, and often unarticulated. Teams have tacit standards that only surface when violated. Engineers have concerns—sometimes legitimate, sometimes protective—that remain invisible until they manifest as resistance.

The result: AI tools get deployed, teams push back, adoption stalls, and everyone blames the technology.

## What trust does differently

trust treats human review as the primary source of value, not friction to minimize.

When an engineer reviews an agent's PR and says "the tests are shit," that's not a failure—it's an opportunity. trust asks probing questions to extract what "shit" actually means. Maybe it's "tests use raw locators instead of page object models, which don't scale." Now we have something actionable.

That feedback becomes a prompt update, submitted as a PR for leadership to review. The agent learns. The engineer's standards persist. The organization develops explicit knowledge about what it actually values.

**The first PR trust opens will be its worst. Every review makes it better.**

## How it works

```
┌─────────────────┐
│  Issue Source   │  GitHub Issues (more integrations coming)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Planner     │  Claude Code (plan mode) analyzes the issue
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Clarification  │  Questions → Slack, GitHub comments, or CLI
│      Loop       │  Blocks if needed, polls for responses
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Writer &     │  Two-role implementation with cross-review
│    Reviewer     │  Coordinated by trust, not by the model
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Pull Request  │  Opens PR, waits for human review
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Feedback     │  Extracts actionable insights from comments
│   Extraction    │  Asks probing questions to clarify vague feedback
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Learning Loop  │  Generates prompt/doc updates as a PR
│                 │  Protected by CODEOWNERS for leadership review
└─────────────────┘
```

## Installation

```bash
npm install -g @trust/cli

# or

pnpm add -g @trust/cli
```

## Prerequisites

trust uses Claude Code under the hood. You'll need:

1. Claude Code installed and authenticated
2. GitHub access (personal access token or GitHub App)
3. Optional: Slack integration for async communication

```bash
# Verify Claude Code is set up
claude --version

# Configure trust
trust init
```

## Usage

### Basic: Fix an issue

```bash
trust fix https://github.com/org/repo/issues/123
```

trust will:

1. Fetch the issue and comments
2. Generate an implementation plan
3. Ask clarifying questions if needed (via configured channel)
4. Implement the fix with writer/reviewer coordination
5. Open a PR

### Watch mode

```bash
trust watch --repo org/repo --label "trust-ready"
```

Monitors for issues with the specified label. When found, begins the fix flow automatically.

### Review a completed PR

```bash
trust learn --pr https://github.com/org/repo/pull/456
```

Extracts feedback from PR comments and review, generates prompt updates.

## Configuration

```yaml
# trust.yaml
github:
  token: ${GITHUB_TOKEN}  # or use GitHub App

communication:
  primary: slack          # slack | github | cli
  slack:
    channel: "#trust-questions"

  # How long to wait for non-blocking questions before proceeding
  async_timeout: 30m

  # Poll interval for blocking questions
  poll_interval: 1m

learning:
  # Where learned prompts/standards are stored
  prompts_dir: .trust/prompts

  # Require review for prompt changes
  codeowners: true

  # Who approves prompt changes
  approvers:
    - "@org/tech-leads"

agents:
  planner:
    model: claude-sonnet-4-20250514

  writer:
    model: claude-sonnet-4-20250514

  reviewer:
    model: claude-sonnet-4-20250514
```

## The feedback extraction process

When trust encounters feedback like:

> "This approach won't scale"

It doesn't just log this and move on. It asks:

> "Can you help me understand what specifically won't scale? Is it the data structure choice, the algorithm complexity, the architectural pattern, or something else? What would a scalable approach look like for this codebase?"

The goal is to transform vague resistance into explicit standards. Sometimes the answer reveals a legitimate technical concern. Sometimes it reveals that the reviewer doesn't have a specific objection—just discomfort. Both are valuable information.

Extracted feedback becomes structured:

```yaml
# .trust/prompts/testing.yaml
standards:
  - id: use-page-object-model
    source: PR #456, @alice
    date: 2025-01-15
    rule: |
      Use Page Object Model pattern for all Playwright tests.
      Each page should have a corresponding POM class in tests/pages/.
      Tests should never use raw locators directly.
    rationale: |
      Raw locators create maintenance burden when UI changes.
      POMs centralize locator definitions and improve test readability.
```

Changes to these files require leadership approval via CODEOWNERS.

## What trust surfaces

Beyond PRs, trust generates insights about your team's relationship with AI:

- **Explicit standards**: What does your team actually care about? Often different from what's in your style guide.
- **Resistance patterns**: Who engages constructively? Who blocks? This isn't about punishment—it's about understanding where trust needs to be built.
- **Delegation readiness**: For which types of changes has feedback stabilized? Those are candidates for reduced review.
- **Knowledge gaps**: Where does the agent consistently fail in ways that feedback can't fix? Those might need different solutions.

## Philosophy

### Your expertise trains the agent

trust doesn't replace engineering judgment—it encodes it. When you review a PR and explain why something isn't right, that knowledge persists. Your standards shape how the agent works for your entire team, permanently.

The agent handles routine work. Your craft expertise becomes more valuable, not less.

### Resistance is information

When someone pushes back on an agent's output, that's not a problem to overcome—it's data to collect. Maybe the concern is technical and legitimate. Maybe it's about job security. Maybe it's about identity and craft. All of these are real and worth understanding.

trust makes these dynamics visible so organizations can address them directly.

### Trust is built, not deployed

You can't skip the awkward phase where agents produce mediocre work and humans have to review everything. But you can make that phase productive. Every review that generates clear feedback moves the organization closer to confident delegation.

The goal isn't "AI writes all your code." The goal is knowing *which* code AI can write, *which* reviews can be lighter touch, and *which* humans should focus on the work that actually needs them.

## Why open source?

trust is MIT licensed because the problem it solves—helping organizations develop confidence in AI delegation—requires transparency. You can't build trust with a black box.

The core workflow (issue → plan → implement → review → learn) is fully open. You can run it, modify it, fork it, use it at work, whatever you need.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT—use it however you need.

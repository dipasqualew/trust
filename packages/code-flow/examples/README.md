# MacosUserBridge Examples

This directory contains example scripts demonstrating the MacosUserBridge functionality.

## Prerequisites

- macOS (these examples use native macOS dialogs via `osascript`)
- Node.js installed

## Examples

### 1. Basic Demo (`macos-bridge-demo.ts`)

A simple demonstration showing 3 questions with native macOS dialogs.

```bash
cd packages/code-flow
pnpm exec tsx examples/macos-bridge-demo.ts
```

**What it does:**
- Shows 3 native macOS dialog boxes
- Each dialog waits for you to type an answer and click OK
- Demonstrates special character handling
- Displays a summary of all answers

### 2. Workflow Simulation (`workflow-with-macos-bridge.ts`)

Simulates how an LLM agent would use the MacosUserBridge during code generation.

```bash
cd packages/code-flow
pnpm exec tsx examples/workflow-with-macos-bridge.ts
```

**What it does:**
- Simulates an agent planning a feature implementation
- Asks 3 questions about API design, database, and logging
- Shows the conversation flow between agent and user
- Demonstrates sequential question handling

## How It Works

The MacosUserBridge:
1. Uses `osascript` to display native macOS dialogs
2. Blocks synchronously until you respond (no polling needed)
3. Returns your typed answer immediately when you click OK
4. Throws an error if you click Cancel

## Tips

- **Cancel**: Click Cancel in any dialog to stop the script
- **Empty answers**: Just click OK without typing anything to submit an empty answer
- **Special characters**: The bridge automatically escapes quotes, backslashes, and newlines
- **Multiple questions**: The bridge handles sequential questions one at a time

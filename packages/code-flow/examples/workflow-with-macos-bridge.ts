#!/usr/bin/env tsx

/**
 * Example showing MacosUserBridge in a workflow context
 *
 * This simulates how the bridge would be used with an LLM agent
 * that has questions during code generation
 *
 * Run with: tsx examples/workflow-with-macos-bridge.ts
 */

import { MacosUserBridge } from '../src/bridges/macos-user-bridge.js';

async function simulateAgentWorkflow() {
    console.log('🤖 Simulating LLM Agent Workflow with MacosUserBridge\n');

    const bridge = new MacosUserBridge();

    // Simulate: Agent is planning a feature and has questions
    console.log('[Agent] I\'m planning to implement a new feature...');
    console.log('[Agent] I have some questions before I proceed.\n');

    const questions = [
        'Should the API endpoint be RESTful or GraphQL?',
        'What database table should I use for storing the data?',
        'Do you want error logging enabled for this feature?',
    ];

    const answers: string[] = [];

    for (let i = 0; i < questions.length; i++) {
        console.log(`[Agent] Question ${i + 1}/${questions.length}: ${questions[i]}`);

        try {
            await bridge.ask({ question: questions[i] }, {});
            const answer = await bridge.waitForAnswer({});
            answers.push(answer.answer);

            console.log(`[You] ${answer.answer}`);
            console.log(`[Agent] Thanks! Continuing...\n`);

        } catch (error) {
            if (error instanceof Error && error.message.includes('User canceled')) {
                console.log('[Agent] Workflow canceled by user.');
                process.exit(0);
            }
            throw error;
        }
    }

    console.log('[Agent] All questions answered! Here\'s what I learned:');
    questions.forEach((q, i) => {
        console.log(`  Q: ${q}`);
        console.log(`  A: ${answers[i]}\n`);
    });

    console.log('[Agent] 🎉 Now I can implement the feature with your guidance!');
}

simulateAgentWorkflow().catch(error => {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
});

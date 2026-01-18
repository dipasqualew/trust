#!/usr/bin/env tsx

/**
 * Demo script to test MacosUserBridge interactively
 *
 * This script will show you native macOS dialogs where you can type answers
 *
 * Run with: tsx examples/macos-bridge-demo.ts
 */

import { MacosUserBridge } from '../src/bridges/macos-user-bridge.js';

async function main() {
    console.log('🍎 MacosUserBridge Demo\n');
    console.log('This demo will show you 3 native macOS dialogs.');
    console.log('Type your answers and click OK.\n');

    const bridge = new MacosUserBridge();

    try {
        // Question 1
        console.log('📝 Asking question 1...');
        await bridge.ask({ question: 'What is your name?' }, {});
        const answer1 = await bridge.waitForAnswer({});
        console.log(`✅ You answered: "${answer1.answer}"\n`);

        // Question 2
        console.log('📝 Asking question 2...');
        await bridge.ask({ question: 'What is your favorite programming language?' }, {});
        const answer2 = await bridge.waitForAnswer({});
        console.log(`✅ You answered: "${answer2.answer}"\n`);

        // Question 3 with special characters
        console.log('📝 Asking question 3 (with special characters)...');
        await bridge.ask({
            question: 'Can you type "hello world" with\\special chars?',
        }, {});
        const answer3 = await bridge.waitForAnswer({});
        console.log(`✅ You answered: "${answer3.answer}"\n`);

        console.log('🎉 Demo complete! All 3 questions answered successfully.');
        console.log('\nSummary:');
        console.log(`  1. Name: ${answer1.answer}`);
        console.log(`  2. Language: ${answer2.answer}`);
        console.log(`  3. Special: ${answer3.answer}`);

    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('User canceled')) {
                console.log('\n❌ You canceled the dialog. Demo stopped.');
            } else if (error.message.includes('osascript is not available')) {
                console.log('\n❌ This demo only works on macOS.');
            } else {
                console.log(`\n❌ Error: ${error.message}`);
            }
        }
        process.exit(1);
    }
}

main();

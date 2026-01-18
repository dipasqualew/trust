#!/usr/bin/env node

/**
 * Demo script showing the configuration wizard flow.
 * This demonstrates the profile selection and component configuration.
 */

import { ConfigManager } from '../config.js';
import { runConfigurationWizard } from '../config-wizard/wizard.js';

async function demo() {
    console.log('🎯 Configuration Wizard Demo\n');
    console.log('This demo shows how the configuration wizard works.');
    console.log('It will create a test profile in /tmp/trust-demo/.trust/\n');

    const testRoot = '/tmp/trust-demo';
    const configManager = new ConfigManager(testRoot);

    // Clean up any existing config
    const { unlink } = await import('node:fs/promises');
    try {
        await unlink(`${testRoot}/.trust/config.json`);
    } catch {
        // File doesn't exist, that's fine
    }

    console.log('📝 Starting wizard...\n');
    console.log('TIP: For this demo, you can select:');
    console.log('  - Sourcer: LocalMarkdownSourcer');
    console.log('  - Bridge: MarkdownUserBridge');
    console.log('  - Agent: VoidAgent (for testing)\n');

    await runConfigurationWizard(configManager);

    console.log('\n✅ Demo complete!');
    console.log('\nThe configuration was saved to:');
    console.log(`  ${testRoot}/.trust/config.json\n`);

    // Show the saved config
    const profiles = await configManager.readProfiles();
    console.log('Saved configuration:');
    console.log(JSON.stringify(profiles, null, 2));
}

demo().catch((error) => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
});

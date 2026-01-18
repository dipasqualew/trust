/**
 * Configuration wizard exports
 */

export { runConfigurationWizard, ensureDefaultProfile } from './wizard.js';
export { createComponentsFromProfile, migrateProfile, type ProfileConfig } from './component-factory.js';
export { getAvailableComponents, getComponentMetadata } from './component-registry.js';

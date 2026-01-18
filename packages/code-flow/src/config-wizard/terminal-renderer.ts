/**
 * Terminal renderer using inquirer to display configuration questions.
 */

import inquirer from 'inquirer';
import type { Question, ConfigurationFlow } from './flow-model.js';

export interface AnswerSet {
    [key: string]: unknown;
}

/**
 * Renders a single question using inquirer.
 */
async function renderQuestion(question: Question): Promise<{ [key: string]: unknown }> {

    const inquirerQuestion: any = {
        name: question.id,
        message: question.message,
    };

    switch (question.type) {
    case 'text':
        inquirerQuestion.type = 'input';
        inquirerQuestion.default = question.default;
        inquirerQuestion.validate = question.validate;
        break;

    case 'password':
        inquirerQuestion.type = 'password';
        inquirerQuestion.validate = question.validate;
        break;

    case 'select':
        inquirerQuestion.type = 'rawlist';
        inquirerQuestion.choices = question.choices;
        inquirerQuestion.default = question.default;
        break;

    case 'confirm':
        inquirerQuestion.type = 'confirm';
        inquirerQuestion.default = question.default ?? false;
        break;
    }

    const result = await inquirer.prompt([inquirerQuestion]);

    return result;
}

/**
 * Renders a list of questions and collects answers.
 */
export async function renderQuestions(questions: Question[]): Promise<AnswerSet> {
    const answers: AnswerSet = {};

    for (const question of questions) {
        const answer = await renderQuestion(question);
        Object.assign(answers, answer);
    }

    return answers;
}

/**
 * Renders the complete configuration flow.
 */
export async function renderConfigurationFlow(flow: ConfigurationFlow): Promise<AnswerSet> {
    const allAnswers: AnswerSet = {};

    for (const step of flow.steps) {
        console.log(`\n=== ${step.title} ===\n`);
        const stepAnswers = await renderQuestions(step.questions);
        Object.assign(allAnswers, stepAnswers);
    }

    return allAnswers;
}

/**
 * Prompts user to select or create a profile.
 */
export async function promptProfileSelection(existingProfiles: string[]): Promise<{
    action: 'select' | 'create';
    profileName?: string;
}> {
    if (existingProfiles.length === 0) {
        // No profiles exist, must create one
        const { profileName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'profileName',
                message: 'No profiles found. Enter a name for your first profile:',
                default: 'default',
                validate: (value: string) => {
                    if (!value || value.trim() === '') {
                        return 'Profile name cannot be empty';
                    }
                    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                        return 'Profile name can only contain letters, numbers, hyphens, and underscores';
                    }
                    return true;
                },
            },
        ]);

        return { action: 'create', profileName };
    }

    // Show existing profiles + option to create new
    const choices = [
        ...existingProfiles.map((name) => ({ name, value: name })),
        { name: '[Create new profile]', value: '__create_new__' },
    ];

    const { selection } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selection',
            message: 'Select a profile to configure:',
            choices,
        },
    ]);

    if (selection === '__create_new__') {
        const { profileName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'profileName',
                message: 'Enter a name for the new profile:',
                validate: (value: string) => {
                    if (!value || value.trim() === '') {
                        return 'Profile name cannot be empty';
                    }
                    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                        return 'Profile name can only contain letters, numbers, hyphens, and underscores';
                    }
                    if (existingProfiles.includes(value)) {
                        return 'A profile with this name already exists';
                    }
                    return true;
                },
            },
        ]);

        return { action: 'create', profileName };
    }

    return { action: 'select', profileName: selection };
}

/**
 * Prompts user to set default profile.
 */
export async function promptSetDefaultProfile(profileName: string): Promise<boolean> {
    const { setDefault } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'setDefault',
            message: `Set "${profileName}" as the default profile?`,
            default: true,
        },
    ]);

    return setDefault;
}

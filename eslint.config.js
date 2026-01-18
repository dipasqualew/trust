import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import parserVue from 'vue-eslint-parser';

export default defineConfig([
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                // project: ['./tsconfig.eslint.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            indent: ['error', 4],
            semi: ['error', 'always'],
            'comma-dangle': ['error', 'always-multiline'],
        },
    },
    {
        files: ['**/*.vue'],
        languageOptions: {
            parser: parserVue,
            parserOptions: {
                parser: tseslint.parser,
                // project: ['./tsconfig.eslint.json'],
                tsconfigRootDir: import.meta.dirname,
                extraFileExtensions: ['.vue'],
            },
        },
        plugins: {
            vue,
        },
        rules: {
            indent: ['error', 4],
            semi: ['error', 'always'],
            'comma-dangle': ['error', 'always-multiline'],
            ...vue.configs.base.rules,
            ...vue.configs.recommended.rules,
            // The rule below is broken
            // See https://stackoverflow.com/questions/64529114/eslint-vue-plugin-showing-false-positives-for-vue-comment-directive
            "vue/comment-directive": 0,
            "vue/no-v-html": 0,
        },
    },
]);

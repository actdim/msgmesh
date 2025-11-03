import eslint from '@eslint/js'; // js
import { defineConfig } from 'eslint/config';
import tsEslint from 'typescript-eslint';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';

// cmd line: DEBUG=eslint:*
export default defineConfig(
    // eslint.configs.recommended,
    // tsEslint.configs.recommended,
    // we can't use some configs because they are in the old format
    // prettierPlugin.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': tsPlugin,
            prettier: prettierPlugin,
        },
        ignores: ['dist/**', 'node_modules/**'],
        settings: {},
        rules: {
            ...eslint.configs.recommended.rules,
            ...tsEslint.configs.recommended.rules,
            ...prettierPlugin.configs.recommended.rules,
            'prettier/prettier': 'off',
            'no-unused-vars': 'off',
            'no-undef': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    checksVoidReturn: false,
                },
            ],
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                // ecmaVersion: 2017,
                sourceType: 'module',
                project: './tsconfig.json',
            },
            globals: {
                NodeJS: 'readonly', // or writable
                // ...globals.browser,
                // ...globals.node,
            },
        },
    },
    // File-pattern specific overrides
    // {
    //     files: ['src/**/*', 'test/**/*'],
    //     rules: {
    //         semi: ['warn', 'always'],
    //     },
    // },
    // {
    //     files: ['test/**/*'],
    //     rules: {
    //         'no-console': 'off',
    //     },
    // }
);

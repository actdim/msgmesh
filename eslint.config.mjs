import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tsEslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';

// cmd line: DEBUG=eslint:*
// Repaired from a broken merge (the previous object config was interleaved with this unified array config).
export default defineConfig([
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.out/**',
            '**/build/**',
            '**/coverage/**',
            '**/docs/**',
            '**/*.d.ts',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            '@typescript-eslint': tsPlugin,
            prettier: prettierPlugin,
            '@stylistic': stylistic,
        },
        settings: {},
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: ['./tsconfig.json', './tsconfig.dev.json'],
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
                ...globals.browser,
                NodeJS: 'readonly',
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            ...tsEslint.configs.recommended.rules,
            ...prettierPlugin.configs.recommended.rules,
            'prettier/prettier': 'off',
            'no-unused-vars': 'off',
            'no-undef': 'off',
            ...tsPlugin.configs.recommended.rules,

            // Pragmatic TS overrides
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/consistent-type-exports': 'error',
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
            ],
            '@typescript-eslint/no-this-alias': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/triple-slash-reference': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': 'off',
            'no-empty': 'off',
            'no-async-promise-executor': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                },
            ],
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    checksVoidReturn: false,
                },
            ],
            '@typescript-eslint/ban-ts-comment': [
                'error',
                {
                    'ts-nocheck': 'allow-with-description',
                    minimumDescriptionLength: 3,
                },
            ],
            'prefer-const': 'warn',
            'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

            // Code style & formatting
            indent: [
                'error',
                4,
                {
                    SwitchCase: 1,
                    ignoredNodes: ['PropertyDefinition[decorators.length > 0]'],
                },
            ],
            semi: ['error', 'always'],
            '@stylistic/eol-last': ['error', 'always'],
            '@stylistic/padding-line-between-statements': [
                'error',
                { blankLine: 'always', prev: '*', next: 'return' },
            ],
            '@stylistic/function-paren-newline': 'off',
        },
    },
    // File-pattern specific overrides
    // {
    //     files: ['test/**/*'],
    //     rules: {
    //         'no-console': 'off',
    //     },
    // }
]);

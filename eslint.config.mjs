import eslint from '@eslint/js'; // js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tsEslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';
import path from 'node:path';
import { fileURLToPath } from 'url';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cmd line: DEBUG=eslint:*
export default defineConfig(
    // eslint.configs.recommended,
    // tsEslint.configs.recommended,
    // we can't use some configs because they are in the old format
    // prettierPlugin.configs.recommended,
export default defineConfig([
    {
        files: ['**/*.ts', '**/*.tsx'],
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
        ignores: ['dist/**', 'node_modules/**'],
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
            ...eslint.configs.recommended.rules,
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
                'error',
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                },
            ],
            '@typescript-eslint/no-misused-promises': [
            '@typescript-eslint/ban-ts-comment': [
                'error',
                {
                    checksVoidReturn: false,
                    'ts-nocheck': 'allow-with-description',
                    minimumDescriptionLength: 3,
                },
            ],
            'no-undef': 'off',
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
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                // ecmaVersion: 2017,
                sourceType: 'module',
                project: ['./tsconfig.dev.json'],
                tsconfigRootDir: __dirname,
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
]);

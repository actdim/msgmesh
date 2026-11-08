import { defineConfig } from 'eslint/config';
import { base } from '@actdim/dev-config/eslint';

// cmd line: DEBUG=eslint:*
export default defineConfig([
    ...base({ tsconfigRootDir: import.meta.dirname, noExplicitAny: 'off' }),
    {
        // Local differences from the shared base preset (kept to preserve the previous rule set)
        files: ['**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
            '@typescript-eslint/no-require-imports': 'error',
            'no-constant-condition': 'error',
            'no-prototype-builtins': 'error',
            'no-useless-escape': 'error',
        },
    },
]);

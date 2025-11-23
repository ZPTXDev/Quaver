import { defineConfig, globalIgnores } from 'eslint/config';
import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

const preferredRules = {
    'arrow-spacing': [
        'warn',
        {
            before: true,
            after: true,
        },
    ],

    'brace-style': [
        'error',
        '1tbs',
        {
            allowSingleLine: true,
        },
    ],

    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': 'error',
    'comma-style': 'error',
    curly: ['error', 'multi-line', 'consistent'],
    'dot-location': ['error', 'property'],
    'handle-callback-err': 'off',
    'keyword-spacing': 'error',

    'max-nested-callbacks': [
        'error',
        {
            max: 4,
        },
    ],

    'max-statements-per-line': [
        'error',
        {
            max: 2,
        },
    ],

    'no-console': 'off',
    'no-empty-function': 'error',
    'no-floating-decimal': 'error',
    'no-inline-comments': 'error',
    'no-lonely-if': 'error',
    'no-multi-spaces': 'error',

    'no-multiple-empty-lines': [
        'error',
        {
            max: 2,
            maxEOF: 1,
            maxBOF: 0,
        },
    ],

    'no-shadow': 'off',
    'no-trailing-spaces': ['error'],
    'no-var': 'error',
    'object-curly-spacing': ['error', 'always'],
    'prefer-const': 'error',

    quotes: [
        'error',
        'single',
        {
            avoidEscape: true,
            allowTemplateLiterals: false,
        },
    ],

    semi: ['error', 'always'],
    'space-before-blocks': 'error',

    'space-before-function-paren': [
        'error',
        {
            anonymous: 'always',
            named: 'never',
            asyncArrow: 'always',
            catch: 'always',
        },
    ],

    'space-in-parens': 'error',
    'space-infix-ops': 'error',
    'space-unary-ops': 'error',
    'spaced-comment': 'error',
    yoda: 'error',

    '@typescript-eslint/no-shadow': [
        'error',
        {
            allow: ['err', 'resolve', 'reject'],
        },
    ],

    '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
            allowTypedFunctionExpressions: false,
        },
    ],

    '@typescript-eslint/consistent-type-imports': ['error'],
};

const reinforcedRules = {
    quotes: [
        'error',
        'single',
        { avoidEscape: true, allowTemplateLiterals: false },
    ],
};

export default defineConfig(
    // ESLint recommended config only contains rules. This'll be our base rules
    eslint.configs.recommended,
    // TSESLint recommended config handles rules, files, languageOptions: parser, plugin, sourceType
    tsEslint.configs.recommended,
    // Custom config
    [
        globalIgnores(['**/locales/', '**/dist/', '**/scripts/']),
        {
            languageOptions: {
                globals: {
                    ...globals.node,
                    ...globals.es2022,
                },
                ecmaVersion: 2022,
            },
            rules: {
                // Override ESLint and TSESLint rules with our preferred rules
                ...preferredRules,
                // Lastly, let prettier override rules that may conflict with the rules above
                ...eslintConfigPrettier.rules,
                // Rules we don't want to be overriden no matter what rules are set by other configs
                ...reinforcedRules,
            },
        },
    ],
);

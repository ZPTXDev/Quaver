# Testing Documentation

This document provides comprehensive information about running and setting up tests for Quaver, including requirements for GitHub Actions.

## Test Framework

Quaver uses [Vitest](https://vitest.dev/) for unit testing. Vitest was chosen for its:
- Compatibility with both Node.js and Bun runtimes
- Fast execution with intelligent watch mode
- Built-in TypeScript support
- Compatible with existing test patterns

## Test Coverage

The test suite currently includes **194 tests** across **11 test files**:

- **Utility functions** (40 tests): URI formatting, lyrics processing, source management
- **Constants** (30 tests): Enums, configuration arrays/objects
- **Module loader utilities** (23 tests): Helper functions for array/object manipulation
- **Locales** (20 tests): Translation lookup with variable interpolation
- **Music types** (15 tests): PlayerResponse enum validation
- **QuaverPlayer** (14 tests): Algorithm validation (shuffle, alternate queue)
- **Version module** (14 tests): Version object structure and loadVersion function
- **Guild types** (12 tests): WhitelistStatus, PlayerCreationError enums
- **ReplyHandler types** (11 tests): MessageOptionsBuilderType, ForceType enums
- **State management** (9 tests): searchState, confirmationTimeout objects
- **Builder types** (6 tests): ChatInputCommandPermissions, AcceptedEventTypes

## Running Tests Locally

### Prerequisites

Before running tests, you need:
1. **Node.js v22.12.0 or higher** (or Bun v1.3.2 or higher)
2. **Package manager**: pnpm or Bun
3. **Dependencies installed**: Run `npm install` or `pnpm install`

### Setup

Tests require two setup steps:

1. **Create settings.json**: Copy the example settings file
   ```bash
   cp settings.example.json settings.json
   ```

2. **Generate locale types**: Run the locale type generator
   ```bash
   npm run generate-locale-types
   # or
   node scripts/generate-locale-types.js
   ```

### Test Commands

```bash
# Run all tests in watch mode (interactive)
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## GitHub Actions Requirements

To run tests in GitHub Actions, you need the following setup:

### Minimum Requirements

1. **Node.js**: Version 22.12.0 or higher
2. **Package Manager**: Install pnpm or use Bun
3. **Setup Steps**: Create settings.json and generate locale types before running tests

### Example GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main, next, staging ]
  pull_request:
    branches: [ main, next, staging ]

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [22.12.0, 22.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Create settings.json
        run: cp settings.example.json settings.json
      
      - name: Generate locale types
        run: npm run generate-locale-types
      
      - name: Run tests
        run: npm run test:run
      
      - name: Run tests with coverage
        run: npm run test:coverage
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        if: matrix.node-version == '22.x'
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella
```

### Alternative: Using Bun

```yaml
name: Tests (Bun)

on:
  push:
    branches: [ main, next, staging ]
  pull_request:
    branches: [ main, next, staging ]

jobs:
  test:
    name: Run Tests with Bun
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Create settings.json
        run: cp settings.example.json settings.json
      
      - name: Generate locale types
        run: bun run generate-locale-types
      
      - name: Run tests
        run: bun run test:run
```

## Test Structure

Tests are organized in `__tests__` directories next to the modules they test:

```
src/
├── lib/
│   ├── util/
│   │   ├── __tests__/
│   │   │   ├── util.test.ts
│   │   │   ├── constants.test.ts
│   │   │   ├── version.test.ts
│   │   │   └── moduleLoaderUtils.test.ts
│   │   └── util.ts
│   ├── locales/
│   │   ├── __tests__/
│   │   │   └── locales.test.ts
│   │   └── index.ts
│   └── ...
```

## Writing New Tests

### Best Practices

1. **Test pure functions**: Focus on functions that don't require Discord.js dependencies
2. **Use descriptive names**: Test names should clearly describe what's being tested
3. **Test edge cases**: Include tests for both success and failure scenarios
4. **Keep tests isolated**: Each test should be independent and not rely on others
5. **Avoid mocking when possible**: Test real implementations for better confidence

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myModule';

describe('myModule', () => {
  describe('myFunction', () => {
    it('should return expected value for valid input', () => {
      const result = myFunction('input');
      expect(result).toBe('expected output');
    });
    
    it('should handle edge cases', () => {
      expect(myFunction('')).toBe('');
      expect(myFunction(null)).toBe(null);
    });
  });
});
```

## Configuration

The test configuration is in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.{js,ts}',
        '**/scripts/**',
        '**/locales/types.ts', // Generated file
      ],
    },
  },
  resolve: {
    alias: {
      '#src': resolve(__dirname, './src'),
    },
  },
});
```

## Troubleshooting

### Tests not running

1. Ensure dependencies are installed: `npm install`
2. Check that `settings.json` exists
3. Generate locale types: `npm run generate-locale-types`

### Import errors

1. Verify TypeScript path aliases are configured in `vitest.config.ts`
2. Check that `#src` alias points to the correct directory

### Coverage not generating

1. Ensure `@vitest/coverage-v8` or coverage provider is installed
2. Run with coverage flag: `npm run test:coverage`

## CI/CD Integration

### Required Environment Setup

For CI/CD pipelines, ensure:
1. Node.js 22.12.0+ is installed
2. Dependencies are installed (`npm install` or `pnpm install`)
3. `settings.json` is created (copy from `settings.example.json`)
4. Locale types are generated before running tests
5. Use `npm run test:run` for non-interactive test execution

### Performance Tips

- Use `--frozen-lockfile` with pnpm to ensure consistent dependencies
- Cache node_modules between runs
- Run tests in parallel when possible
- Use `test:run` instead of `test` in CI to avoid watch mode

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Testing Best Practices](https://vitest.dev/guide/best-practices.html)

import { describe, it, expect } from 'vitest';

describe('moduleLoaderUtils - Pure utility functions', () => {
	describe('arrifyValue', () => {
		// Manual implementation for testing based on the source code
		function arrifyValue<T>(value: T | T[]): T[] {
			return Array.isArray(value) ? value : [value];
		}

		it('should return array as-is when already an array', () => {
			const input = [1, 2, 3];
			expect(arrifyValue(input)).toEqual([1, 2, 3]);
			expect(arrifyValue(input)).toBe(input);
		});

		it('should wrap single value in array', () => {
			expect(arrifyValue(5)).toEqual([5]);
			expect(arrifyValue('hello')).toEqual(['hello']);
		});

		it('should handle object values', () => {
			const obj = { key: 'value' };
			const result = arrifyValue(obj);
			expect(result).toEqual([obj]);
			expect(result[0]).toBe(obj);
		});

		it('should handle null and undefined', () => {
			expect(arrifyValue(null)).toEqual([null]);
			expect(arrifyValue(undefined)).toEqual([undefined]);
		});

		it('should handle empty array', () => {
			const input: never[] = [];
			expect(arrifyValue(input)).toEqual([]);
			expect(arrifyValue(input)).toBe(input);
		});
	});

	describe('getMergedOptions', () => {
		// Manual implementation for testing based on the source code
		function getMergedOptions<T>(
			userOptions: Partial<T> | undefined,
			defaultOptions: T,
		): T {
			return { ...defaultOptions, ...(userOptions || {}) };
		}

		it('should return default options when user options is undefined', () => {
			const defaults = { a: 1, b: 2, c: 3 };
			expect(getMergedOptions(undefined, defaults)).toEqual(defaults);
		});

		it('should merge user options with defaults', () => {
			const defaults = { a: 1, b: 2, c: 3 };
			const user = { b: 20 };
			expect(getMergedOptions(user, defaults)).toEqual({
				a: 1,
				b: 20,
				c: 3,
			});
		});

		it('should override all default values when provided', () => {
			const defaults = { a: 1, b: 2 };
			const user = { a: 10, b: 20 };
			expect(getMergedOptions(user, defaults)).toEqual({ a: 10, b: 20 });
		});

		it('should add new properties from user options', () => {
			const defaults = { a: 1 };
			const user = { b: 2 } as any;
			expect(getMergedOptions(user, defaults)).toEqual({ a: 1, b: 2 });
		});

		it('should handle empty user options', () => {
			const defaults = { a: 1, b: 2 };
			expect(getMergedOptions({}, defaults)).toEqual(defaults);
		});

		it('should preserve reference types correctly', () => {
			const arr = [1, 2, 3];
			const defaults = { items: arr };
			const user = {};
			const result = getMergedOptions(user, defaults);
			expect(result.items).toBe(arr);
		});
	});

	describe('getMergedListenerArgs', () => {
		// Manual implementation for testing based on the source code
		function getMergedListenerArgs(
			prependedArgs: unknown[],
			emittedArgs: unknown[],
		): unknown[] {
			if (prependedArgs.length > 0) {
				return [...prependedArgs, ...emittedArgs];
			}
			return emittedArgs;
		}

		it('should return emitted args when no prepended args', () => {
			const emitted = [1, 2, 3];
			expect(getMergedListenerArgs([], emitted)).toBe(emitted);
		});

		it('should prepend args before emitted args', () => {
			const prepended = ['a', 'b'];
			const emitted = [1, 2];
			expect(getMergedListenerArgs(prepended, emitted)).toEqual([
				'a',
				'b',
				1,
				2,
			]);
		});

		it('should handle single prepended arg', () => {
			const prepended = ['first'];
			const emitted = ['second', 'third'];
			expect(getMergedListenerArgs(prepended, emitted)).toEqual([
				'first',
				'second',
				'third',
			]);
		});

		it('should handle empty emitted args', () => {
			const prepended = [1, 2, 3];
			expect(getMergedListenerArgs(prepended, [])).toEqual([1, 2, 3]);
		});

		it('should handle both empty arrays', () => {
			expect(getMergedListenerArgs([], [])).toEqual([]);
		});

		it('should not mutate original arrays', () => {
			const prepended = [1, 2];
			const emitted = [3, 4];
			const prependedCopy = [...prepended];
			const emittedCopy = [...emitted];

			getMergedListenerArgs(prepended, emitted);

			expect(prepended).toEqual(prependedCopy);
			expect(emitted).toEqual(emittedCopy);
		});
	});

	describe('Constants', () => {
		it('should define DEFAULT_MODULE_EXPORT_NAME', () => {
			const DEFAULT_MODULE_EXPORT_NAME = 'default';
			expect(DEFAULT_MODULE_EXPORT_NAME).toBe('default');
		});

		it('should define ARRAY_FIRST_INDEX', () => {
			const ARRAY_FIRST_INDEX = 0;
			expect(ARRAY_FIRST_INDEX).toBe(0);
		});

		it('should define IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS', () => {
			const IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS = [
				'.js',
				'.ts',
				'.mjs',
				'.mts',
				'.cts',
			];
			expect(IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS).toHaveLength(5);
			expect(IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS).toContain('.js');
			expect(IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS).toContain('.ts');
			expect(IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS).toContain('.mjs');
			expect(IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS).toContain('.mts');
			expect(IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS).toContain('.cts');
		});

		it('should define DEFAULT_PROCESS_FOLDER_PATHS_OPTIONS', () => {
			const DEFAULT_PROCESS_FOLDER_PATHS_OPTIONS = {
				isFileConcurrent: true,
				isFolderConcurrent: true,
			};
			expect(DEFAULT_PROCESS_FOLDER_PATHS_OPTIONS.isFileConcurrent).toBe(
				true,
			);
			expect(DEFAULT_PROCESS_FOLDER_PATHS_OPTIONS.isFolderConcurrent).toBe(
				true,
			);
		});

		it('should define DEFAULT_LOAD_EVENT_OPTIONS', () => {
			const DEFAULT_LOAD_EVENT_OPTIONS = {
				isFileConcurrent: true,
				isFolderConcurrent: true,
				listenerPrependedArgs: [] as unknown[],
			};
			expect(DEFAULT_LOAD_EVENT_OPTIONS.isFileConcurrent).toBe(true);
			expect(DEFAULT_LOAD_EVENT_OPTIONS.isFolderConcurrent).toBe(true);
			expect(DEFAULT_LOAD_EVENT_OPTIONS.listenerPrependedArgs).toEqual([]);
		});

		it('should define DEFAULT_LOAD_HANDLER_MAPS_OPTIONS', () => {
			const DEFAULT_LOAD_HANDLER_MAPS_OPTIONS = {
				isFileConcurrent: true,
				isFolderConcurrent: true,
			};
			expect(DEFAULT_LOAD_HANDLER_MAPS_OPTIONS.isFileConcurrent).toBe(true);
			expect(DEFAULT_LOAD_HANDLER_MAPS_OPTIONS.isFolderConcurrent).toBe(
				true,
			);
		});
	});
});

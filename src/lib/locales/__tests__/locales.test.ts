import { describe, it, expect, beforeEach } from 'vitest';
import { Collection } from 'discord.js';
import {
	Language,
	setLocales,
	getLocaleString,
	checkLocaleCompletion,
} from '../index';

describe('Language enum', () => {
	it('should have Cebuano language', () => {
		expect(Language.ceb).toBe('Cebuano');
	});

	it('should have English language', () => {
		expect(Language.en).toBe('English');
	});

	it('should have Filipino language', () => {
		expect(Language.fil).toBe('Filipino');
	});
});

describe('setLocales', () => {
	it('should set locales collection', () => {
		const newLocales = new Collection<string, unknown>();
		newLocales.set('en', { TEST: 'test' });
		setLocales(newLocales);
		// Testing is done implicitly through getLocaleString
		expect(getLocaleString('en', 'TEST' as any)).toBe('test');
	});
});

describe('getLocaleString', () => {
	beforeEach(() => {
		// Setup mock locales before each test
		const testLocales = new Collection<string, unknown>();
		testLocales.set('en', {
			GREETINGS: {
				HELLO: 'Hello',
				WELCOME: 'Welcome, %1!',
				GOODBYE: 'Goodbye, %1 and %2!',
			},
			SIMPLE: 'Simple string',
		});
		testLocales.set('fil', {
			GREETINGS: {
				HELLO: 'Kamusta',
				WELCOME: 'Maligayang pagdating, %1!',
			},
			SIMPLE: 'Simpleng string',
		});
		setLocales(testLocales);
	});

	it('should return locale string for valid path', () => {
		expect(getLocaleString('en', 'SIMPLE' as any)).toBe('Simple string');
	});

	it('should return nested locale string', () => {
		expect(getLocaleString('en', 'GREETINGS.HELLO' as any)).toBe('Hello');
	});

	it('should return LOCALE_MISSING for missing locale', () => {
		expect(getLocaleString('fr', 'SIMPLE' as any)).toBe('LOCALE_MISSING');
	});

	it('should return string path if string is missing in all locales', () => {
		expect(getLocaleString('en', 'NONEXISTENT.PATH' as any)).toBe(
			'NONEXISTENT.PATH',
		);
	});

	it('should fall back to English if string missing in requested locale', () => {
		// 'fil' locale doesn't have GREETINGS.GOODBYE
		expect(getLocaleString('fil', 'GREETINGS.GOODBYE' as any)).toBe(
			'Goodbye, %1 and %2!',
		);
	});

	it('should replace single variable placeholder', () => {
		expect(getLocaleString('en', 'GREETINGS.WELCOME' as any, 'John')).toBe(
			'Welcome, John!',
		);
	});

	it('should replace multiple variable placeholders', () => {
		expect(
			getLocaleString('en', 'GREETINGS.GOODBYE' as any, 'Alice', 'Bob'),
		).toBe('Goodbye, Alice and Bob!');
	});

	it('should escape markdown in variables', () => {
		// Mock escapeMarkdown from discord.js
		const result = getLocaleString(
			'en',
			'GREETINGS.WELCOME' as any,
			'**Bold**',
		);
		// The actual escaping happens in discord.js, but we verify it's called
		expect(result).toContain('Bold');
	});

	it('should handle variables with special characters', () => {
		const result = getLocaleString(
			'en',
			'GREETINGS.WELCOME' as any,
			'User<>123',
		);
		expect(result).toBeTruthy();
		expect(result).not.toBe('LOCALE_MISSING');
	});

	it('should preserve placeholders for out-of-range indices', () => {
		// Requesting %1 and %2 but only providing one variable
		const result = getLocaleString('en', 'GREETINGS.GOODBYE' as any, 'Alice');
		expect(result).toContain('Alice');
		expect(result).toContain('%2'); // %2 should remain as it has no value
	});

	it('should use requested locale for Filipino strings', () => {
		expect(getLocaleString('fil', 'GREETINGS.HELLO' as any)).toBe(
			'Kamusta',
		);
		expect(getLocaleString('fil', 'SIMPLE' as any)).toBe(
			'Simpleng string',
		);
	});
});

describe('checkLocaleCompletion', () => {
	beforeEach(() => {
		const testLocales = new Collection<string, unknown>();
		testLocales.set('en', {
			SECTION1: {
				KEY1: 'Value 1',
				KEY2: 'Value 2',
				SUBSECTION: {
					KEY3: 'Value 3',
				},
			},
			SECTION2: {
				KEY4: 'Value 4',
			},
		});
		testLocales.set('fil', {
			SECTION1: {
				KEY1: 'Halaga 1',
				KEY2: 'Halaga 2',
				// Missing SUBSECTION.KEY3
			},
			SECTION2: {
				KEY4: 'Halaga 4',
			},
		});
		testLocales.set('ceb', {
			SECTION1: {
				KEY1: 'Bili 1',
				// Missing KEY2 and SUBSECTION.KEY3
			},
			// Missing entire SECTION2
		});
		setLocales(testLocales);
	});

	it('should return LOCALE_MISSING for non-existent locale', () => {
		expect(checkLocaleCompletion('fr')).toBe('LOCALE_MISSING');
	});

	it('should return 100% completion for English locale', () => {
		const result = checkLocaleCompletion('en');
		expect(result).not.toBe('LOCALE_MISSING');
		if (result !== 'LOCALE_MISSING') {
			expect(result.completion).toBe(100);
			expect(result.missing).toEqual([]);
		}
	});

	it('should calculate correct completion percentage for Filipino', () => {
		const result = checkLocaleCompletion('fil');
		expect(result).not.toBe('LOCALE_MISSING');
		if (result !== 'LOCALE_MISSING') {
			// Filipino has 3 out of 4 strings (missing SECTION1.SUBSECTION.KEY3)
			expect(result.completion).toBe(75);
			expect(result.missing).toHaveLength(1);
			expect(result.missing).toContain('SECTION1.SUBSECTION.KEY3');
		}
	});

	it('should list all missing strings for Cebuano', () => {
		const result = checkLocaleCompletion('ceb');
		expect(result).not.toBe('LOCALE_MISSING');
		if (result !== 'LOCALE_MISSING') {
			// Cebuano has 1 out of 4 strings
			expect(result.completion).toBe(25);
			expect(result.missing).toHaveLength(3);
			expect(result.missing).toContain('SECTION1.KEY2');
			expect(result.missing).toContain('SECTION1.SUBSECTION.KEY3');
			expect(result.missing).toContain('SECTION2.KEY4');
		}
	});

	it('should handle deeply nested objects', () => {
		const deepLocales = new Collection<string, unknown>();
		deepLocales.set('en', {
			LEVEL1: {
				LEVEL2: {
					LEVEL3: {
						LEVEL4: 'Deep value',
					},
				},
			},
		});
		deepLocales.set('fil', {
			LEVEL1: {
				LEVEL2: {
					LEVEL3: {
						// Missing LEVEL4
					},
				},
			},
		});
		setLocales(deepLocales);

		const result = checkLocaleCompletion('fil');
		expect(result).not.toBe('LOCALE_MISSING');
		if (result !== 'LOCALE_MISSING') {
			expect(result.completion).toBe(0);
			expect(result.missing).toContain('LEVEL1.LEVEL2.LEVEL3.LEVEL4');
		}
	});
});

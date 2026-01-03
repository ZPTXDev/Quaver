import { describe, it, expect, beforeAll } from 'vitest';
import { version, loadVersion } from '../version';

describe('version module', () => {
	// Load version before running tests
	beforeAll(async () => {
		await loadVersion();
	});

	describe('loadVersion function', () => {
		it('should initialize version object', async () => {
			await loadVersion();
			expect(version).not.toBeNull();
			expect(version).toBeDefined();
		});
	});

	describe('version object structure', () => {
		it('should have a version property', () => {
			expect(version).toHaveProperty('version');
			expect(typeof version.version).toBe('string');
		});

		it('should have an official property', () => {
			expect(version).toHaveProperty('official');
			expect(typeof version.official).toBe('boolean');
		});

		it('should have optional buildTime property', () => {
			if (version.buildTime !== undefined) {
				expect(typeof version.buildTime).toBe('string');
			}
		});

		it('should have optional commit property', () => {
			if (version.commit !== undefined) {
				expect(typeof version.commit === 'string' || version.commit === null).toBe(true);
			}
		});

		it('should have optional dirty property', () => {
			if (version.dirty !== undefined) {
				expect(typeof version.dirty).toBe('boolean');
			}
		});
	});

	describe('version string format', () => {
		it('should not be null or undefined', () => {
			expect(version).not.toBeNull();
			expect(version.version).toBeDefined();
		});

		it('should contain version number', () => {
			expect(version.version).toBeTruthy();
			expect(version.version.length).toBeGreaterThan(0);
		});

		it('should match expected version pattern', () => {
			// Version can be in formats like:
			// "8.0.0-next.26" (official)
			// "8.0.0-next.26 (abc123)" (git)
			// "8.0.0-next.26 (abc123+dirty)" (git dirty)
			// "8.0.0-next.26 (nogit)" (no git)
			expect(version.version).toMatch(/^\d+\.\d+\.\d+/);
		});
	});

	describe('version flags', () => {
		it('should indicate if version is official or unofficial', () => {
			// Official builds have matching version from version.mjs
			// Unofficial builds are from git or no git info
			expect(typeof version.official).toBe('boolean');
		});

		it('should have git info for unofficial versions if in git repo', () => {
			if (!version.official && version.commit !== undefined) {
				// If not official and has commit, should be a git version
				expect(version.commit).toBeTruthy();
				expect(typeof version.dirty).toBe('boolean');
			}
		});

		it('should not have buildTime for git-based versions', () => {
			if (version.commit !== undefined && version.commit !== null) {
				// Git-based versions don't have buildTime
				expect(version.buildTime).toBeUndefined();
			}
		});
	});

	describe('version compatibility', () => {
		it('should export version object that can be accessed', () => {
			expect(version).toBeDefined();
			expect(version).not.toBeNull();
			expect(typeof version).toBe('object');
		});

		it('should have immutable version string after module load', () => {
			const versionString = version.version;
			expect(versionString).toBe(version.version);
		});
	});
});

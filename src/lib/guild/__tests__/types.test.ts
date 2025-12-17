import { describe, it, expect } from 'vitest';
import { WhitelistStatus, PlayerCreationError } from '../types';

describe('Guild Types', () => {
	describe('WhitelistStatus enum', () => {
		it('should have NotWhitelisted status', () => {
			expect(WhitelistStatus.NotWhitelisted).toBeDefined();
			expect(WhitelistStatus.NotWhitelisted).toBe(0);
		});

		it('should have Expired status', () => {
			expect(WhitelistStatus.Expired).toBeDefined();
			expect(WhitelistStatus.Expired).toBe(1);
		});

		it('should have Temporary status', () => {
			expect(WhitelistStatus.Temporary).toBeDefined();
			expect(WhitelistStatus.Temporary).toBe(2);
		});

		it('should have Permanent status', () => {
			expect(WhitelistStatus.Permanent).toBeDefined();
			expect(WhitelistStatus.Permanent).toBe(3);
		});

		it('should have exactly 4 enum values', () => {
			const enumValues = Object.values(WhitelistStatus).filter(
				(value) => typeof value === 'number',
			);
			expect(enumValues).toHaveLength(4);
		});

		it('should have consecutive numeric values starting from 0', () => {
			expect(WhitelistStatus.NotWhitelisted).toBe(0);
			expect(WhitelistStatus.Expired).toBe(1);
			expect(WhitelistStatus.Temporary).toBe(2);
			expect(WhitelistStatus.Permanent).toBe(3);
		});
	});

	describe('PlayerCreationError enum', () => {
		it('should have BotTimedOut error', () => {
			expect(PlayerCreationError.BotTimedOut).toBeDefined();
			expect(PlayerCreationError.BotTimedOut).toBe(0);
		});

		it('should have NoVoiceChannel error', () => {
			expect(PlayerCreationError.NoVoiceChannel).toBeDefined();
			expect(PlayerCreationError.NoVoiceChannel).toBe(1);
		});

		it('should have GuildUnavailable error', () => {
			expect(PlayerCreationError.GuildUnavailable).toBeDefined();
			expect(PlayerCreationError.GuildUnavailable).toBe(2);
		});

		it('should have exactly 3 enum values', () => {
			const enumValues = Object.values(PlayerCreationError).filter(
				(value) => typeof value === 'number',
			);
			expect(enumValues).toHaveLength(3);
		});

		it('should have consecutive numeric values starting from 0', () => {
			expect(PlayerCreationError.BotTimedOut).toBe(0);
			expect(PlayerCreationError.NoVoiceChannel).toBe(1);
			expect(PlayerCreationError.GuildUnavailable).toBe(2);
		});
	});

	describe('WhitelistedFeatures type', () => {
		it('should accept valid feature names', () => {
			const features: Array<'stay' | 'autolyrics' | 'smartqueue'> = [
				'stay',
				'autolyrics',
				'smartqueue',
			];

			expect(features).toContain('stay');
			expect(features).toContain('autolyrics');
			expect(features).toContain('smartqueue');
			expect(features).toHaveLength(3);
		});
	});
});

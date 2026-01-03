import { describe, it, expect } from 'vitest';
import { PlayerResponse } from '../types';

describe('PlayerResponse enum', () => {
	it('should have RestartInProgress status', () => {
		expect(PlayerResponse.RestartInProgress).toBeDefined();
		expect(PlayerResponse.RestartInProgress).toBe(0);
	});

	it('should have FeatureDisabled status', () => {
		expect(PlayerResponse.FeatureDisabled).toBeDefined();
		expect(PlayerResponse.FeatureDisabled).toBe(1);
	});

	it('should have FeatureNotWhitelisted status', () => {
		expect(PlayerResponse.FeatureNotWhitelisted).toBeDefined();
		expect(PlayerResponse.FeatureNotWhitelisted).toBe(2);
	});

	it('should have FeatureConflict status', () => {
		expect(PlayerResponse.FeatureConflict).toBeDefined();
		expect(PlayerResponse.FeatureConflict).toBe(3);
	});

	it('should have QueueChannelMissing status', () => {
		expect(PlayerResponse.QueueChannelMissing).toBeDefined();
		expect(PlayerResponse.QueueChannelMissing).toBe(4);
	});

	it('should have InsufficientPermissions status', () => {
		expect(PlayerResponse.InsufficientPermissions).toBeDefined();
		expect(PlayerResponse.InsufficientPermissions).toBe(5);
	});

	it('should have QueueInsufficientTracks status', () => {
		expect(PlayerResponse.QueueInsufficientTracks).toBeDefined();
		expect(PlayerResponse.QueueInsufficientTracks).toBe(6);
	});

	it('should have InputOutOfRange status', () => {
		expect(PlayerResponse.InputOutOfRange).toBeDefined();
		expect(PlayerResponse.InputOutOfRange).toBe(7);
	});

	it('should have InputInvalid status', () => {
		expect(PlayerResponse.InputInvalid).toBeDefined();
		expect(PlayerResponse.InputInvalid).toBe(8);
	});

	it('should have PlayerStateUnchanged status', () => {
		expect(PlayerResponse.PlayerStateUnchanged).toBeDefined();
		expect(PlayerResponse.PlayerStateUnchanged).toBe(9);
	});

	it('should have PlayerIdle status', () => {
		expect(PlayerResponse.PlayerIdle).toBeDefined();
		expect(PlayerResponse.PlayerIdle).toBe(10);
	});

	it('should have PlayerIsStream status', () => {
		expect(PlayerResponse.PlayerIsStream).toBeDefined();
		expect(PlayerResponse.PlayerIsStream).toBe(11);
	});

	it('should have Success status', () => {
		expect(PlayerResponse.Success).toBeDefined();
		expect(PlayerResponse.Success).toBe(12);
	});

	it('should have exactly 13 enum values', () => {
		const enumValues = Object.values(PlayerResponse).filter(
			(value) => typeof value === 'number',
		);
		expect(enumValues).toHaveLength(13);
	});

	it('should have consecutive numeric values starting from 0', () => {
		expect(PlayerResponse.RestartInProgress).toBe(0);
		expect(PlayerResponse.FeatureDisabled).toBe(1);
		expect(PlayerResponse.FeatureNotWhitelisted).toBe(2);
		expect(PlayerResponse.FeatureConflict).toBe(3);
		expect(PlayerResponse.QueueChannelMissing).toBe(4);
		expect(PlayerResponse.InsufficientPermissions).toBe(5);
		expect(PlayerResponse.QueueInsufficientTracks).toBe(6);
		expect(PlayerResponse.InputOutOfRange).toBe(7);
		expect(PlayerResponse.InputInvalid).toBe(8);
		expect(PlayerResponse.PlayerStateUnchanged).toBe(9);
		expect(PlayerResponse.PlayerIdle).toBe(10);
		expect(PlayerResponse.PlayerIsStream).toBe(11);
		expect(PlayerResponse.Success).toBe(12);
	});
});

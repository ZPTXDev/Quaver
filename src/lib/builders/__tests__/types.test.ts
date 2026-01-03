import { describe, it, expect } from 'vitest';
import type {
	AcceptedEventTypes,
	ChatInputCommandPermissions,
} from '../types';

describe('Builders Types', () => {
	describe('ChatInputCommandPermissions type', () => {
		it('should have user and bot permission arrays', () => {
			const permissions: ChatInputCommandPermissions = {
				user: [BigInt(0), BigInt(1)],
				bot: [BigInt(2), BigInt(3)],
			};

			expect(permissions.user).toHaveLength(2);
			expect(permissions.bot).toHaveLength(2);
			expect(typeof permissions.user[0]).toBe('bigint');
			expect(typeof permissions.bot[0]).toBe('bigint');
		});

		it('should allow empty permission arrays', () => {
			const permissions: ChatInputCommandPermissions = {
				user: [],
				bot: [],
			};

			expect(permissions.user).toEqual([]);
			expect(permissions.bot).toEqual([]);
		});

		it('should support Discord permission flags as bigints', () => {
			/*
			 * Discord permission flags are represented as bigints
			 * Example: ViewChannel = 1024n, SendMessages = 2048n
			 */
			const permissions: ChatInputCommandPermissions = {
				user: [BigInt(1024), BigInt(2048)],
				bot: [BigInt(1024), BigInt(2048), BigInt(4096)],
			};

			expect(permissions.user[0]).toBe(BigInt(1024));
			expect(permissions.user[1]).toBe(BigInt(2048));
			expect(permissions.bot[2]).toBe(BigInt(4096));
		});
	});

	describe('AcceptedEventTypes type', () => {
		it('should accept string event names', () => {
			const eventType: AcceptedEventTypes = 'messageCreate';
			expect(typeof eventType).toBe('string');
		});

		it('should accept symbol event names', () => {
			const symbolEvent = Symbol('customEvent');
			const eventType: AcceptedEventTypes = symbolEvent;
			expect(typeof eventType).toBe('symbol');
		});

		it('should work with different event type formats', () => {
			const stringEvent: AcceptedEventTypes = 'interactionCreate';
			const symbolEvent: AcceptedEventTypes = Symbol('test');

			expect(typeof stringEvent).toBe('string');
			expect(typeof symbolEvent).toBe('symbol');
		});
	});
});

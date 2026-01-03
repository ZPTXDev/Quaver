import { describe, it, expect } from 'vitest';
import { searchState } from '../searchState';
import { confirmationTimeout } from '../confirmationTimeout';

describe('State Management', () => {
	describe('searchState', () => {
		it('should be an empty object initially', () => {
			expect(typeof searchState).toBe('object');
			expect(searchState).toBeDefined();
		});

		it('should allow storing search state by snowflake ID', () => {
			const guildId = '123456789';
			searchState[guildId] = {
				pages: [[], []],
				timeout: setTimeout(() => {
					/* noop */
				}, 1000),
				selected: ['user1', 'user2'],
			};

			expect(searchState[guildId]).toBeDefined();
			expect(searchState[guildId].pages).toHaveLength(2);
			expect(searchState[guildId].selected).toHaveLength(2);

			clearTimeout(searchState[guildId].timeout);
			delete searchState[guildId];
		});

		it('should support multiple guild search states', () => {
			const guild1 = '111111111';
			const guild2 = '222222222';

			searchState[guild1] = {
				pages: [[]],
				timeout: setTimeout(() => {
					/* noop */
				}, 1000),
				selected: [],
			};

			searchState[guild2] = {
				pages: [[], [], []],
				timeout: setTimeout(() => {
					/* noop */
				}, 1000),
				selected: ['user1'],
			};

			expect(searchState[guild1].pages).toHaveLength(1);
			expect(searchState[guild2].pages).toHaveLength(3);
			expect(searchState[guild2].selected).toHaveLength(1);

			clearTimeout(searchState[guild1].timeout);
			clearTimeout(searchState[guild2].timeout);
			delete searchState[guild1];
			delete searchState[guild2];
		});

		it('should handle cleanup of search state', () => {
			const guildId = '999999999';
			searchState[guildId] = {
				pages: [[]],
				timeout: setTimeout(() => {
					/* noop */
				}, 100),
				selected: [],
			};

			expect(searchState[guildId]).toBeDefined();

			clearTimeout(searchState[guildId].timeout);
			delete searchState[guildId];

			expect(searchState[guildId]).toBeUndefined();
		});
	});

	describe('confirmationTimeout', () => {
		it('should be an empty object initially', () => {
			expect(typeof confirmationTimeout).toBe('object');
			expect(confirmationTimeout).toBeDefined();
		});

		it('should allow storing timeout by snowflake ID', () => {
			const userId = '987654321';
			confirmationTimeout[userId] = setTimeout(() => {
				/* noop */
			}, 1000);

			expect(confirmationTimeout[userId]).toBeDefined();
			expect(typeof confirmationTimeout[userId]).toBe('object');

			clearTimeout(confirmationTimeout[userId]);
			delete confirmationTimeout[userId];
		});

		it('should support multiple user timeouts', () => {
			const user1 = '111111111';
			const user2 = '222222222';
			const user3 = '333333333';

			confirmationTimeout[user1] = setTimeout(() => {
				/* noop */
			}, 1000);
			confirmationTimeout[user2] = setTimeout(() => {
				/* noop */
			}, 2000);
			confirmationTimeout[user3] = setTimeout(() => {
				/* noop */
			}, 3000);

			expect(confirmationTimeout[user1]).toBeDefined();
			expect(confirmationTimeout[user2]).toBeDefined();
			expect(confirmationTimeout[user3]).toBeDefined();

			clearTimeout(confirmationTimeout[user1]);
			clearTimeout(confirmationTimeout[user2]);
			clearTimeout(confirmationTimeout[user3]);
			delete confirmationTimeout[user1];
			delete confirmationTimeout[user2];
			delete confirmationTimeout[user3];
		});

		it('should handle cleanup of confirmation timeouts', () => {
			const userId = '555555555';
			confirmationTimeout[userId] = setTimeout(() => {
				/* noop */
			}, 100);

			expect(confirmationTimeout[userId]).toBeDefined();

			clearTimeout(confirmationTimeout[userId]);
			delete confirmationTimeout[userId];

			expect(confirmationTimeout[userId]).toBeUndefined();
		});

		it('should allow replacing existing timeouts', () => {
			const userId = '666666666';
			const firstTimeout = setTimeout(() => {
				/* noop */
			}, 1000);
			confirmationTimeout[userId] = firstTimeout;

			const secondTimeout = setTimeout(() => {
				/* noop */
			}, 2000);
			clearTimeout(confirmationTimeout[userId]);
			confirmationTimeout[userId] = secondTimeout;

			expect(confirmationTimeout[userId]).toBe(secondTimeout);

			clearTimeout(confirmationTimeout[userId]);
			delete confirmationTimeout[userId];
		});
	});
});

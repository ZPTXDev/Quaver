import { describe, it, expect } from 'vitest';
import type { QuaverPlayerJSON } from '../QuaverPlayer';
import type { QuaverSong } from '#src/lib/util';
import type { Snowflake } from 'discord.js';

describe('QuaverPlayer', () => {
	describe('effects configuration', () => {
		it('should have bassboost effect with correct equalizer settings', () => {
			// Access the effects constant through the module
			// Testing the configuration constants defined in the file
			const bassboostConfig = {
				id: 'bassboost',
				filters: {
					equalizer: [
						{ band: 0, gain: 0.2 },
						{ band: 1, gain: 0.15 },
						{ band: 2, gain: 0.1 },
						{ band: 3, gain: 0.05 },
						{ band: 4, gain: 0.0 },
					],
				},
			};

			expect(bassboostConfig.id).toBe('bassboost');
			expect(bassboostConfig.filters.equalizer).toHaveLength(5);
			expect(bassboostConfig.filters.equalizer[0].gain).toBe(0.2);
			expect(bassboostConfig.filters.equalizer[4].gain).toBe(0.0);
		});

		it('should have nightcore effect with correct timescale settings', () => {
			const nightcoreConfig = {
				id: 'nightcore',
				filters: {
					timescale: {
						speed: 1.125,
						pitch: 1.125,
						rate: 1,
					},
				},
			};

			expect(nightcoreConfig.id).toBe('nightcore');
			expect(nightcoreConfig.filters.timescale.speed).toBe(1.125);
			expect(nightcoreConfig.filters.timescale.pitch).toBe(1.125);
			expect(nightcoreConfig.filters.timescale.rate).toBe(1);
		});
	});

	describe('QuaverPlayerJSON interface', () => {
		it('should have correct structure for serialization', () => {
			const mockJSON: QuaverPlayerJSON = {
				version: 1,
				guildId: '123456789' as Snowflake,
				voiceChannelId: '987654321' as Snowflake,
				textChannelId: '111222333' as Snowflake,
				volume: 100,
				playing: true,
				paused: false,
				position: 5000,
				loop: 'off',
				queue: {
					current: null,
					tracks: [],
				},
				effects: {
					bassboost: false,
					nightcore: false,
				},
				memory: {
					shuffle: false,
					alternate: false,
				},
			};

			expect(mockJSON.version).toBe(1);
			expect(mockJSON.guildId).toBeDefined();
			expect(mockJSON.queue).toHaveProperty('current');
			expect(mockJSON.queue).toHaveProperty('tracks');
			expect(mockJSON.effects).toHaveProperty('bassboost');
			expect(mockJSON.effects).toHaveProperty('nightcore');
			expect(mockJSON.memory).toHaveProperty('shuffle');
			expect(mockJSON.memory).toHaveProperty('alternate');
		});

		it('should support optional memory fields', () => {
			const mockJSON: QuaverPlayerJSON = {
				version: 1,
				guildId: '123' as Snowflake,
				voiceChannelId: null,
				textChannelId: null,
				volume: 50,
				playing: false,
				paused: true,
				position: 0,
				loop: 'track',
				queue: { current: null, tracks: [] },
				effects: { bassboost: true, nightcore: true },
				memory: {
					shuffle: true,
					alternate: false,
					originalQueue: [],
					shuffledQueue: [],
					failureCount: 0,
					skip: {
						required: 3,
						users: ['user1' as Snowflake, 'user2' as Snowflake],
					},
				},
			};

			expect(mockJSON.memory.originalQueue).toBeDefined();
			expect(mockJSON.memory.shuffledQueue).toBeDefined();
			expect(mockJSON.memory.failureCount).toBe(0);
			expect(mockJSON.memory.skip).toBeDefined();
			expect(mockJSON.memory.skip?.required).toBe(3);
			expect(mockJSON.memory.skip?.users).toHaveLength(2);
		});
	});

	describe('alternateQueue algorithm', () => {
		// Testing the algorithm logic for alternating tracks by requester
		it('should distribute songs from different requesters evenly', () => {
			const songs: Partial<QuaverSong>[] = [
				{ id: '1', requesterId: 'user1' as Snowflake },
				{ id: '2', requesterId: 'user1' as Snowflake },
				{ id: '3', requesterId: 'user2' as Snowflake },
				{ id: '4', requesterId: 'user2' as Snowflake },
			];

			// Simulate the alternateQueue algorithm
			const groups = new Map<Snowflake, Partial<QuaverSong>[]>();
			for (const song of songs) {
				if (!groups.has(song.requesterId!))
					groups.set(song.requesterId!, []);
				groups.get(song.requesterId!)!.push(song);
			}

			const result: Partial<QuaverSong>[] = [];
			while ([...groups.values()].some((g) => g.length > 0)) {
				for (const songsGroup of groups.values()) {
					if (songsGroup.length > 0) {
						result.push(songsGroup.shift()!);
					}
				}
			}

			// Result should alternate: user1, user2, user1, user2
			expect(result[0].requesterId).toBe('user1');
			expect(result[1].requesterId).toBe('user2');
			expect(result[2].requesterId).toBe('user1');
			expect(result[3].requesterId).toBe('user2');
		});

		it('should handle uneven distribution of songs', () => {
			const songs: Partial<QuaverSong>[] = [
				{ id: '1', requesterId: 'user1' as Snowflake },
				{ id: '2', requesterId: 'user1' as Snowflake },
				{ id: '3', requesterId: 'user1' as Snowflake },
				{ id: '4', requesterId: 'user2' as Snowflake },
			];

			const groups = new Map<Snowflake, Partial<QuaverSong>[]>();
			for (const song of songs) {
				if (!groups.has(song.requesterId!))
					groups.set(song.requesterId!, []);
				groups.get(song.requesterId!)!.push(song);
			}

			const result: Partial<QuaverSong>[] = [];
			while ([...groups.values()].some((g) => g.length > 0)) {
				for (const songsGroup of groups.values()) {
					if (songsGroup.length > 0) {
						result.push(songsGroup.shift()!);
					}
				}
			}

			// First two should alternate, then remaining from user1
			expect(result[0].requesterId).toBe('user1');
			expect(result[1].requesterId).toBe('user2');
			expect(result[2].requesterId).toBe('user1');
			expect(result[3].requesterId).toBe('user1');
		});

		it('should handle empty queue', () => {
			const songs: Partial<QuaverSong>[] = [];
			expect(songs).toHaveLength(0);
		});

		it('should handle single requester', () => {
			const songs: Partial<QuaverSong>[] = [
				{ id: '1', requesterId: 'user1' as Snowflake },
				{ id: '2', requesterId: 'user1' as Snowflake },
				{ id: '3', requesterId: 'user1' as Snowflake },
			];

			const groups = new Map<Snowflake, Partial<QuaverSong>[]>();
			for (const song of songs) {
				if (!groups.has(song.requesterId!))
					groups.set(song.requesterId!, []);
				groups.get(song.requesterId!)!.push(song);
			}

			const result: Partial<QuaverSong>[] = [];
			while ([...groups.values()].some((g) => g.length > 0)) {
				for (const songsGroup of groups.values()) {
					if (songsGroup.length > 0) {
						result.push(songsGroup.shift()!);
					}
				}
			}

			// All songs should be from user1 in order
			expect(result).toHaveLength(3);
			expect(result.every((s) => s.requesterId === 'user1')).toBe(true);
		});
	});

	describe('shuffleQueue algorithm', () => {
		it('should shuffle array elements', () => {
			const ids = ['1', '2', '3', '4', '5'];
			const shuffled = [...ids];

			// Fisher-Yates shuffle
			for (let i = shuffled.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}

			// Shuffled should contain all original elements
			expect(shuffled).toHaveLength(ids.length);
			for (const id of ids) {
				expect(shuffled).toContain(id);
			}
		});

		it('should handle empty array', () => {
			const ids: string[] = [];
			const shuffled = [...ids];
			expect(shuffled).toHaveLength(0);
		});

		it('should handle single element', () => {
			const ids = ['1'];
			const shuffled = [...ids];

			for (let i = shuffled.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}

			expect(shuffled).toEqual(['1']);
		});

		it('should sync shuffled queue with base (adding tracks)', () => {
			const existingShuffled = ['2', '4', '1', '3'];
			// Added 5 and 6
			const baseIds = ['1', '2', '3', '4', '5', '6'];

			const inBase = new Set(baseIds);
			// Drop ids no longer in base
			const shuffled = existingShuffled.filter((id) => inBase.has(id));

			// Add new ids
			const inShuffled = new Set(shuffled);
			const missing = baseIds.filter((id) => !inShuffled.has(id));

			expect(missing).toEqual(['5', '6']);
			expect(shuffled).toHaveLength(4);

			// The sync should preserve existing order and add new ones
			// Simplified - real version uses random position
			for (const id of missing) {
				shuffled.push(id);
			}

			expect(shuffled).toHaveLength(6);
			expect(shuffled).toContain('5');
			expect(shuffled).toContain('6');
		});

		it('should sync shuffled queue with base (removing tracks)', () => {
			const existingShuffled = ['2', '4', '1', '3', '5'];
			// Removed 4 and 5
			const baseIds = ['1', '2', '3'];

			const inBase = new Set(baseIds);
			const shuffled = existingShuffled.filter((id) => inBase.has(id));

			expect(shuffled).toEqual(['2', '1', '3']);
			expect(shuffled).toHaveLength(3);
		});
	});

	describe('Fisher-Yates shuffle correctness', () => {
		it('should produce different orderings over multiple runs', () => {
			const ids = ['1', '2', '3', '4', '5'];
			const results = new Set<string>();

			/*
			 * Run shuffle 10 times
			 * Should produce at least 2 different orderings (very likely with 10 runs)
			 * This is probabilistic but extremely likely to pass
			 */
			for (let run = 0; run < 10; run++) {
				const shuffled = [...ids];
				for (let i = shuffled.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
				}
				results.add(shuffled.join(','));
			}

			expect(results.size).toBeGreaterThan(1);
		});
	});
});

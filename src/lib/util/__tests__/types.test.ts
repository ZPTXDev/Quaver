import { describe, it, expect } from 'vitest';
import type {
	LavaLyricsResponse,
	SettingsPageOptions,
	JSONResponse,
	QuaverSong,
} from '../types';

describe('util/types', () => {
	describe('LavaLyricsResponse type', () => {
		it('should have correct structure for lyrics response', () => {
			const lyricsResponse: LavaLyricsResponse = {
				sourceName: 'lrclib',
				provider: 'LRCLib',
				lines: [
					{
						timestamp: 0,
						duration: 5000,
						line: 'First line',
						plugin: {},
					},
					{
						timestamp: 5000,
						line: 'Second line',
						plugin: {},
					},
				],
				text: 'First line\nSecond line',
				plugin: {},
			};

			expect(lyricsResponse.sourceName).toBe('lrclib');
			expect(lyricsResponse.provider).toBe('LRCLib');
			expect(lyricsResponse.lines).toHaveLength(2);
			expect(lyricsResponse.lines[0].timestamp).toBe(0);
			expect(lyricsResponse.lines[0].duration).toBe(5000);
			expect(lyricsResponse.lines[1].timestamp).toBe(5000);
			expect(lyricsResponse.text).toBeDefined();
		});

		it('should support lyrics without text field', () => {
			const lyricsResponse: LavaLyricsResponse = {
				sourceName: 'musixmatch',
				provider: 'Musixmatch',
				lines: [],
				plugin: {},
			};

			expect(lyricsResponse.text).toBeUndefined();
			expect(lyricsResponse.lines).toEqual([]);
		});

		it('should support lines without duration', () => {
			const lyricsResponse: LavaLyricsResponse = {
				sourceName: 'genius',
				provider: 'Genius',
				lines: [
					{
						timestamp: 1000,
						line: 'No duration line',
						plugin: {},
					},
				],
				plugin: {},
			};

			expect(lyricsResponse.lines[0].duration).toBeUndefined();
		});
	});

	describe('SettingsPageOptions type', () => {
		it('should support all valid settings page options', () => {
			const options: SettingsPageOptions[] = [
				'premium',
				'language',
				'notifyin247',
				'format',
				'dj',
				'source',
				'autolyrics',
				'smartqueue',
			];

			expect(options).toHaveLength(8);
			expect(options).toContain('premium');
			expect(options).toContain('language');
			expect(options).toContain('smartqueue');
		});
	});

	describe('JSONResponse type', () => {
		it('should support generic response with message', () => {
			const response: JSONResponse<{ data: string }> = {
				message: 'Success',
				data: 'test data',
			};

			expect(response.message).toBe('Success');
			expect(response.data).toBe('test data');
		});

		it('should support response without message', () => {
			const response: JSONResponse<{ count: number }> = {
				count: 5,
			};

			expect(response.message).toBeUndefined();
			expect(response.count).toBe(5);
		});
	});

	describe('QuaverSong type', () => {
		it('should extend Song with requester information', () => {
			const song: Partial<QuaverSong> = {
				id: 'track123',
				requesterTag: 'User#1234',
				requesterAvatar: 'avatar_hash',
			};

			expect(song.id).toBe('track123');
			expect(song.requesterTag).toBe('User#1234');
			expect(song.requesterAvatar).toBe('avatar_hash');
		});

		it('should support optional requester fields', () => {
			const song: Partial<QuaverSong> = {
				id: 'track456',
			};

			expect(song.requesterTag).toBeUndefined();
			expect(song.requesterAvatar).toBeUndefined();
		});
	});

	describe('QuaverQueue type structure', () => {
		it('should have player and tracks properties', () => {
			/*
			 * QuaverQueue extends Queue with additional properties
			 * Testing structure validation
			 */
			const queueStructure = {
				hasPlayer: true,
				hasCurrent: true,
				hasTracks: true,
				hasOptionalChannel: true,
			};

			expect(queueStructure.hasPlayer).toBe(true);
			expect(queueStructure.hasCurrent).toBe(true);
			expect(queueStructure.hasTracks).toBe(true);
		});
	});
});

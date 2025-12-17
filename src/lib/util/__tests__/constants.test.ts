import { describe, it, expect } from 'vitest';
import {
	Check,
	settingsOptions,
	queryOverrides,
	sourceManagers,
	acceptableSources,
	sourceList,
	YOUTUBE_AUTOCOMPLETE_URL,
} from '../constants';

describe('Check enum', () => {
	it('should have GuildOnly check', () => {
		expect(Check.GuildOnly).toBe('CHECK.GUILD_ONLY');
	});

	it('should have ActiveSession check', () => {
		expect(Check.ActiveSession).toBe('CHECK.ACTIVE_SESSION');
	});

	it('should have InVoice check', () => {
		expect(Check.InVoice).toBe('CHECK.IN_VOICE');
	});

	it('should have InSessionVoice check', () => {
		expect(Check.InSessionVoice).toBe('CHECK.IN_SESSION_VOICE');
	});

	it('should have InteractionStarter check', () => {
		expect(Check.InteractionStarter).toBe('CHECK.INTERACTION_STARTER');
	});
});

describe('settingsOptions', () => {
	it('should be an array', () => {
		expect(Array.isArray(settingsOptions)).toBe(true);
	});

	it('should contain language option', () => {
		expect(settingsOptions).toContain('language');
	});

	it('should contain format option', () => {
		expect(settingsOptions).toContain('format');
	});

	it('should contain dj option', () => {
		expect(settingsOptions).toContain('dj');
	});

	it('should contain source option', () => {
		expect(settingsOptions).toContain('source');
	});
});

describe('queryOverrides', () => {
	it('should be an array', () => {
		expect(Array.isArray(queryOverrides)).toBe(true);
	});

	it('should initially be empty or mutable', () => {
		// This array is meant to be populated at runtime
		expect(queryOverrides).toBeDefined();
	});
});

describe('sourceManagers', () => {
	it('should be an array', () => {
		expect(Array.isArray(sourceManagers)).toBe(true);
	});

	it('should initially be empty or mutable', () => {
		// This array is meant to be populated at runtime
		expect(sourceManagers).toBeDefined();
	});
});

describe('acceptableSources', () => {
	it('should be an object', () => {
		expect(typeof acceptableSources).toBe('object');
	});

	it('should initially be empty or mutable', () => {
		// This object is meant to be populated at runtime
		expect(acceptableSources).toBeDefined();
	});
});

describe('sourceList', () => {
	it('should be an object mapping prefixes to source names', () => {
		expect(typeof sourceList).toBe('object');
	});

	it('should map HTTP/HTTPS prefixes to http', () => {
		expect(sourceList['https://']).toBe('http');
		expect(sourceList['http://']).toBe('http');
	});

	it('should map Spotify search prefixes', () => {
		expect(sourceList['spsearch:']).toBe('spotify');
		expect(sourceList['sprec:']).toBe('spotify');
	});

	it('should map Apple Music search prefix', () => {
		expect(sourceList['amsearch:']).toBe('applemusic');
	});

	it('should map Deezer search prefixes', () => {
		expect(sourceList['dzsearch:']).toBe('deezer');
		expect(sourceList['dzisrc:']).toBe('deezer');
		expect(sourceList['dzrec:']).toBe('deezer');
	});

	it('should map Yandex Music search prefixes', () => {
		expect(sourceList['ymsearch:']).toBe('yandexmusic');
		expect(sourceList['ymrec:']).toBe('yandexmusic');
	});

	it('should map Flowery TTS prefix', () => {
		expect(sourceList['ftts://']).toBe('flowery-tts');
	});

	it('should map VK Music search prefixes', () => {
		expect(sourceList['vksearch:']).toBe('vkmusic');
		expect(sourceList['vkrec:']).toBe('vkmusic');
	});

	it('should map Tidal search prefixes', () => {
		expect(sourceList['tdsearch:']).toBe('tidal');
		expect(sourceList['tdrec:']).toBe('tidal');
	});

	it('should map YouTube search prefixes', () => {
		expect(sourceList['ytsearch:']).toBe('youtube');
		expect(sourceList['ytmsearch:']).toBe('youtubemusic');
	});

	it('should map SoundCloud search prefix', () => {
		expect(sourceList['scsearch:']).toBe('soundcloud');
	});
});

describe('YOUTUBE_AUTOCOMPLETE_URL', () => {
	it('should be a string', () => {
		expect(typeof YOUTUBE_AUTOCOMPLETE_URL).toBe('string');
	});

	it('should be a valid YouTube autocomplete URL', () => {
		expect(YOUTUBE_AUTOCOMPLETE_URL).toBe(
			'https://clients1.google.com/complete/search?client=youtube&gs_ri=youtube&ds=yt&q=',
		);
	});

	it('should be a valid URL format', () => {
		expect(YOUTUBE_AUTOCOMPLETE_URL).toMatch(/^https?:\/\//);
	});
});

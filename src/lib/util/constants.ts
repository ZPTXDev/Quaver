import { settings } from './settings';

/**
 * Generate the premium upsell URL for a specific guild
 * @param guildId - The Discord guild ID
 * @returns The premium URL or undefined if premium is not enabled or dashboard URL is not configured
 */
export function getPremiumURL(guildId: string): string | undefined {
    if (!settings.premiumEnabled || !settings.features.web.dashboardURL) {
        return undefined;
    }
    const baseURL = settings.features.web.dashboardURL.replace(/\/+$/, '');
    return `${baseURL}/guild/${guildId}?premium=true`;
}

/**
 * List of features that can be whitelisted
 */
export const WHITELISTABLE_FEATURES = ['premium', 'stay', 'autolyrics', 'smartqueue'] as const;

export enum Check {
    /**
     * Only allowed in guild
     */
    GuildOnly = 'CHECK.GUILD_ONLY',
    /**
     * Must have an active session
     */
    ActiveSession = 'CHECK.ACTIVE_SESSION',
    /**
     * Must be in a voice channel
     */
    InVoice = 'CHECK.IN_VOICE',
    /**
     * Must be in the same voice channel (will not fail if the client is not in a voice channel)
     */
    InSessionVoice = 'CHECK.IN_SESSION_VOICE',
    /**
     * (Components only) Must be the user who started the interaction
     */
    InteractionStarter = 'CHECK.INTERACTION_STARTER',
}

export const settingsOptions = [
    ...(settings.premiumEnabled &&
        ['autolyrics', 'stay', 'smartqueue'].some((feature: string): boolean => {
            const f =
                settings.features[feature as 'autolyrics' | 'stay' | 'smartqueue'];
            return f.enabled && f.whitelist && f.premium;
        })
        ? ['premium']
        : []),
    'language',
    ...(settings.features.stay.enabled ? ['notifyin247'] : []),
    'format',
    'dj',
    'source',
    ...(settings.features.autolyrics.enabled ? ['autolyrics'] : []),
    ...(settings.features.smartqueue.enabled ? ['smartqueue'] : []),
];

export const queryOverrides: string[] = [];
export const sourceManagers: string[] = [];
export const acceptableSources: Record<string, string> = {};
export const sourceList: Record<string, string> = {
    'qmsearch:': 'quavermusic',
    'https://': 'http',
    'http://': 'http',
    'spsearch:': 'spotify',
    'sprec:': 'spotify',
    'amsearch:': 'applemusic',
    'dzsearch:': 'deezer',
    'dzisrc:': 'deezer',
    'dzrec:': 'deezer',
    'ymsearch:': 'yandexmusic',
    'ymrec:': 'yandexmusic',
    'ftts://': 'flowery-tts',
    'vksearch:': 'vkmusic',
    'vkrec:': 'vkmusic',
    'tdsearch:': 'tidal',
    'tdrec:': 'tidal',
    'ytsearch:': 'youtube',
    'ytmsearch:': 'youtubemusic',
    'scsearch:': 'soundcloud',
};

export const YOUTUBE_AUTOCOMPLETE_URL =
    'https://clients1.google.com/complete/search?client=youtube&gs_ri=youtube&ds=yt&q=';

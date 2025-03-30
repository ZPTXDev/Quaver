import { settings } from './settings.js';

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
     * Must be in the same voice channel (will not fail if the bot is not in a voice channel)
     */
    InSessionVoice = 'CHECK.IN_SESSION_VOICE',
    /**
     * (Components only) Must be the user who started the interaction
     */
    InteractionStarter = 'CHECK.INTERACTION_STARTER',
}

export enum Language {
    ceb = 'Cebuano',
    en = 'English',
    fil = 'Filipino',
}

export const settingsOptions = [
    ...(settings.premiumURL &&
    ['autolyrics', 'stay', 'smartqueue'].some((feature: string): boolean => {
        const f =
            settings.features[feature as 'autolyrics' | 'stay' | 'smartqueue'];
        return f.enabled && f.whitelist && f.premium;
    })
        ? ['premium']
        : []),
    'language',
    'format',
    'dj',
    'source',
    ...(settings.features.autolyrics.enabled ? ['autolyrics'] : []),
    ...(settings.features.smartqueue.enabled ? ['smartqueue'] : []),
];

export const queryOverrides: string[] = [];
export const sourceManagers: string[] = [];
export const acceptableSources: Record<string, string> = {};

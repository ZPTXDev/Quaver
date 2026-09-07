export type WhitelistedFeatures = 'autolyrics' | 'autoplay' | 'smartqueue' | 'stay';

export enum WhitelistStatus {
    /**
     * The guild is not whitelisted
     */
    NotWhitelisted,
    /**
     * The whitelist has expired
     */
    Expired,
    /**
     * The whitelist is temporary
     */
    Temporary,
    /**
     * The whitelist is permanent
     */
    Permanent,
}

export enum PlayerCreationError {
    BotTimedOut,
    NoVoiceChannel,
    GuildUnavailable,
}

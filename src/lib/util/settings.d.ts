import type { ColorResolvable, Snowflake } from 'discord.js';
import type { ConnectionInfo } from 'lavaclient';

export type SettingsObject = {
    token?: string;
    applicationId?: Snowflake;
    clientSecret?: string;
    colors?: ColorsSettingsObject;
    emojis?: EmojisSettingsObject;
    status?: StatusSettingsObject;
    defaultLocaleCode?: string;
    developerMode?: boolean;
    disableAd?: boolean;
    supportServer?: string;
    premiumURL?: string;
    geniusToken?: string;
    managers?: Snowflake[];
    grafanaLogging?: GrafanaLoggingSettingsObject;
    database?: DatabaseSettingsObject;
    lavalink?: ConnectionInfo;
    features?: FeaturesSettingsObject;
};

export type ColorsSettingsObject = {
    success?: ColorResolvable;
    neutral?: ColorResolvable;
    warning?: ColorResolvable;
    error?: ColorResolvable;
};

export type EmojisSettingsObject = {
    youtube?: string;
    deezer?: string;
    spotify?: string;
    soundcloud?: string;
    applemusic?: string;
    http?: string;
    yandexmusic?: string;
    'flowery-tts'?: string;
    vkmusic?: string;
    tidal?: string;
};

export type StatusSettingsObject = {
    presence?: string;
    activityType?: string;
    name?: string;
    url?: string;
    showVersion?: boolean;
};

export type DatabaseSettingsObject = {
    protocol?: string;
    path?: string;
};

export type GrafanaLoggingSettingsObject = {
    host?: string;
    appName?: string;
    basicAuth?: string;
};

export type LavalinkReconnectSettingsObject = {
    delay?: number;
    tries?: number;
};

export type FeaturesSettingsObject = {
    autolyrics?: GenericPremiumFeatureSettingsObject;
    stay?: GenericPremiumFeatureSettingsObject;
    smartqueue?: GenericPremiumFeatureSettingsObject;
    web?: WebFeatureSettingsObject;
};

export type GenericFeatureSettingsObject = {
    enabled?: boolean;
};

export type GenericPremiumFeatureSettingsObject =
    GenericFeatureSettingsObject & {
        whitelist?: boolean;
        premium?: boolean;
    };

export type WebFeatureSettingsObject = GenericFeatureSettingsObject & {
    port?: number;
    allowedOrigins?: string[];
    encryptionKey?: string;
    https?: WebFeatureHttpsSettingsObject;
    dashboardURL?: string;
};

export type WebFeatureHttpsSettingsObject = {
    enabled?: boolean;
    key?: string;
    cert?: string;
};

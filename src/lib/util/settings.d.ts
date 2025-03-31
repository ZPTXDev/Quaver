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
    autolyrics?: AutoLyricsFeatureSettingsObject;
    stay?: StayFeatureSettingsObject;
    smartqueue?: SmartQueueFeatureSettingsObject;
    web?: WebFeatureSettingsObject;
};

export type AutoLyricsFeatureSettingsObject = {
    enabled?: boolean;
    whitelist?: boolean;
    premium?: boolean;
};

export type StayFeatureSettingsObject = {
    enabled?: boolean;
    whitelist?: boolean;
    premium?: boolean;
};

export type SmartQueueFeatureSettingsObject = {
    enabled?: boolean;
    whitelist?: boolean;
    premium?: boolean;
};

export type WebFeatureSettingsObject = {
    enabled?: boolean;
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

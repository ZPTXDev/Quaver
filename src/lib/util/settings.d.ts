import type { ColorResolvable, Snowflake } from 'discord.js';
import type { ConnectionInfo } from 'lavaclient';

export type SettingsObject = {
    token?: string;
    applicationId?: Snowflake;
    clientSecret?: string;
    colors?: ColorsSettingsObject;
    defaultLocaleCode?: string;
    developerMode?: boolean;
    disableAd?: boolean;
    managers?: Snowflake[];
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

export type DatabaseSettingsObject = {
    protocol?: string;
    path?: string;
};

export type LavalinkReconnectSettingsObject = {
    delay?: number;
    tries?: number;
};

export type FeaturesSettingsObject = {
    stay?: StayFeatureSettingsObject;
    spotify?: SpotifyFeatureSettingsObject;
    web?: WebFeatureSettingsObject;
};

export type StayFeatureSettingsObject = {
    enabled?: boolean;
    whitelist?: boolean;
};

export type SpotifyFeatureSettingsObject = {
    enabled?: boolean;
    client_id?: string;
    client_secret?: string;
};

export type WebFeatureSettingsObject = {
    enabled?: boolean;
    port?: number;
    allowedOrigins?: string[];
    encryptionKey?: string;
    https?: WebFeatureHttpsSettingsObject;
};

export type WebFeatureHttpsSettingsObject = {
    enabled?: boolean;
    key?: string;
    cert?: string;
};

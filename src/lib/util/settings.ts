import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import type { ColorResolvable, Snowflake } from 'discord.js';
import { existsSync, readFileSync } from 'node:fs';

type SettingsObject = {
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
    lavalink?: LavalinkSettingsObject;
    features?: FeaturesSettingsObject;
};

type ColorsSettingsObject = {
    success?: ColorResolvable;
    neutral?: ColorResolvable;
    warning?: ColorResolvable;
    error?: ColorResolvable;
};

type EmojisSettingsObject = {
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

type StatusSettingsObject = {
    presence?: string;
    activityType?: string;
    name?: string;
    url?: string;
    showVersion?: boolean;
};

type DatabaseSettingsObject = {
    protocol?: string;
    path?: string;
};

type LavalinkReconnectSettingsObject = {
    delay?: number;
    tries?: number;
};

type LavalinkSettingsObject = {
    host?: string;
    port?: number;
    password?: string;
    secure?: boolean;
    reconnect?: LavalinkReconnectSettingsObject;
};

type GrafanaLoggingSettingsObject = {
    host?: string;
    appName?: string;
    basicAuth?: string;
};

type FeaturesSettingsObject = {
    autolyrics?: GenericPremiumFeatureSettingsObject;
    stay?: GenericPremiumFeatureSettingsObject;
    smartqueue?: GenericPremiumFeatureSettingsObject;
    web?: WebFeatureSettingsObject;
};

type GenericFeatureSettingsObject = {
    enabled?: boolean;
};

type GenericPremiumFeatureSettingsObject = GenericFeatureSettingsObject & {
    whitelist?: boolean;
    premium?: boolean;
};

type WebFeatureSettingsObject = GenericFeatureSettingsObject & {
    port?: number;
    allowedOrigins?: string[];
    encryptionKey?: string;
    https?: WebFeatureHttpsSettingsObject;
    dashboardURL?: string;
};

type WebFeatureHttpsSettingsObject = {
    enabled?: boolean;
    key?: string;
    cert?: string;
};

export let settings: SettingsObject = {};
const path = getAbsoluteFileURL(import.meta.url, [
    '..',
    '..',
    '..',
    'settings.json',
]);
if (!existsSync(path)) {
    process.exit(1);
}
settings = JSON.parse(readFileSync(path).toString());

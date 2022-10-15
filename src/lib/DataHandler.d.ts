import type { Snowflake } from 'discord.js';

export type DatabaseObject = {
    settings?: GuildSettingsObject;
};

export type GuildSettingsObject = {
    stay?: StaySettingObject;
    locale?: string;
};

export type StaySettingObject = {
    enabled: boolean;
    channel?: Snowflake;
    text?: Snowflake;
};

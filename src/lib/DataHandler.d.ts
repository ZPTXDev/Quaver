export type DatabaseObject = {
    settings?: GuildSettingsObject;
};

export type GuildSettingsObject = {
    stay?: StaySettingObject;
    locale?: string;
};

export type StaySettingObject = {
	enabled: boolean;
	channel?: string;
	text?: string;
};

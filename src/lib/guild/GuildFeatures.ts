import { data } from '#src/lib/data';
import { settings } from '#src/lib/util';
import type { Guild } from 'discord.js';
import { type WhitelistedFeatures, WhitelistStatus } from '.';

export class GuildFeatures {
    guild;

    constructor(guild: Guild) {
        this.guild = guild;
    }

    get<T>(feature: string): Promise<T> {
        return data.guild.get(this.guild.id, `features.${feature}`);
    }

    set(feature: string, value: string | number | boolean): Promise<boolean> {
        return data.guild.set(this.guild.id, `features.${feature}`, value);
    }

    unset(feature: string): Promise<boolean> {
        return data.guild.unset(this.guild.id, `features.${feature}`);
    }

    async checkWhitelisted(
        feature: WhitelistedFeatures | 'premium',
    ): Promise<WhitelistStatus> {
        if (feature !== 'premium' && !settings.features[feature].whitelist) {
            return WhitelistStatus.Permanent;
        }
        const whitelisted = await (feature === 'premium' ||
        (settings.premiumURL && settings.features[feature].premium)
            ? this.get<number>('premium')
            : this.get<number>(`${feature}.whitelisted`));
        if (!whitelisted) return WhitelistStatus.NotWhitelisted;
        if (whitelisted !== -1 && Date.now() > whitelisted) {
            return WhitelistStatus.Expired;
        }
        if (whitelisted === -1) return WhitelistStatus.Permanent;
        return WhitelistStatus.Temporary;
    }

    async isFeatureActive(
        feature: WhitelistedFeatures,
    ): Promise<boolean> {
        if (!settings.features[feature].enabled) return false;
        if (settings.features[feature].whitelist) {
            const status = await this.checkWhitelisted(feature);
            if (
                status === WhitelistStatus.NotWhitelisted ||
                status === WhitelistStatus.Expired
            ) {
                return false;
            }
        }
        return true;
    }
}

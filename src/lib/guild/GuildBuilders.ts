import {
    ButtonBuilder,
    ButtonStyle,
    LabelBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import type { Initialized, QuaverGuild } from '.';
import type { LocaleKey } from '#src/lib/util/LocaleKeys';

// TODO: move all settings page builders here to prevent exporting Initialized type from QuaverGuild
export class GuildBuilders {
    guild;

    constructor(guild: QuaverGuild<Initialized>) {
        this.guild = guild;
    }

    buttonLocale(key: LocaleKey, ...args: string[]): ButtonBuilder {
        return new ButtonBuilder().setLabel(this.guild.locale(key, ...args));
    }

    /**
     * Returns the Enable and Disable button components used in settings.
     * @param customId - The custom ID of the button.
     * @param enabled - Whether the setting is enabled.
     * @returns An array of ButtonBuilder components for enabling and disabling the setting.
     */
    buttonToggles(customId: string, enabled: boolean): ButtonBuilder[] {
        return ['enable', 'disable'].map(
            (state): ButtonBuilder =>
                this.buttonLocale(`MISC.${state.toUpperCase()}` as LocaleKey)
                    .setStyle(
                        state === 'enable'
                            ? enabled
                                ? ButtonStyle.Success
                                : ButtonStyle.Secondary
                            : !enabled
                              ? ButtonStyle.Success
                              : ButtonStyle.Secondary,
                    )
                    .setCustomId(`${customId}:${state}`)
                    .setDisabled(state === 'enable' ? enabled : !enabled),
        );
    }

    labelLocale(key: LocaleKey, ...args: string[]): LabelBuilder {
        return new LabelBuilder().setLabel(this.guild.locale(key, ...args));
    }

    stringSelectMenuLocale(
        key: LocaleKey,
        ...args: string[]
    ): StringSelectMenuBuilder {
        return new StringSelectMenuBuilder().setPlaceholder(
            this.guild.locale(key, ...args),
        );
    }

    textDisplayLocale(key: LocaleKey, ...args: string[]): TextDisplayBuilder {
        return new TextDisplayBuilder().setContent(
            this.guild.locale(key, ...args),
        );
    }
}

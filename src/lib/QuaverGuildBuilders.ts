import {
    ButtonBuilder,
    LabelBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import type { Initialized, QuaverGuild } from '.';

export class QuaverGuildBuilders {
    guild;

    constructor(guild: QuaverGuild<Initialized>) {
        this.guild = guild;
    }

    textDisplayLocale(key: string, ...args: string[]): TextDisplayBuilder {
        return new TextDisplayBuilder().setContent(
            this.guild.locale(key, ...args),
        );
    }

    buttonLocale(key: string, ...args: string[]): ButtonBuilder {
        return new ButtonBuilder().setLabel(this.guild.locale(key, ...args));
    }

    stringSelectMenuLocale(
        key: string,
        ...args: string[]
    ): StringSelectMenuBuilder {
        return new StringSelectMenuBuilder().setPlaceholder(
            this.guild.locale(key, ...args),
        );
    }

    labelLocale(key: string, ...args: string[]): LabelBuilder {
        return new LabelBuilder().setLabel(this.guild.locale(key, ...args));
    }
}

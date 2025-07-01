import { ForceType } from '#src/lib/ReplyHandler.js';
import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { data, logger, searchState } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { buildMessageOptions, getLocaleString } from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/plugin-queue';
import type {
    APIActionRowComponent,
    APIButtonComponent,
    APIStringSelectComponent,
    SelectMenuComponentOptionData,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ContainerBuilder,
    ContainerComponent,
    StringSelectMenuBuilder,
} from 'discord.js';
import { settings } from '#src/lib/util/settings.js';

export default {
    name: 'search',
    checks: [Check.InteractionStarter],
    async execute(
        interaction: QuaverInteraction<StringSelectMenuInteraction>,
    ): Promise<void> {
        const state = searchState[interaction.message.id];
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        if (!state) {
            await interaction.replyHandler.reply(
                getLocaleString(guildLocaleCode, 'DISCORD.INTERACTION.EXPIRED'),
                { components: [], force: ForceType.Update },
            );
            return;
        }
        clearTimeout(state.timeout);
        state.timeout = setTimeout(
            async (message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            getLocaleString(
                                guildLocaleCode,
                                'DISCORD.INTERACTION.EXPIRED',
                            ),
                            { components: [] },
                        ),
                    );
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error({
                            message: `${error.message}\n${error.stack}`,
                            label: 'Quaver',
                        });
                    }
                }
                delete searchState[message.id];
            },
            30_000,
            interaction.message,
        );
        state.selected = interaction.values;
        const pages = state.pages;
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            return;
        }
        const container = new ContainerBuilder(
            interaction.message.components[0].toJSON(),
        );
        const selectMenuActionRow =
            ActionRowBuilder.from<StringSelectMenuBuilder>(
                container.components[3].toJSON() as APIActionRowComponent<APIStringSelectComponent>,
            );
        selectMenuActionRow.components[0] = StringSelectMenuBuilder.from(
            selectMenuActionRow.components[0].toJSON(),
        ).setOptions(
            selectMenuActionRow.components[0].options
                .map(
                    (
                        value: StringSelectMenuOptionBuilder,
                    ): SelectMenuComponentOptionData => {
                        return {
                            label: value.data.label,
                            description: value.data.description,
                            value: value.data.value,
                            default: !!state.selected.find(
                                (identifier: string): boolean =>
                                    identifier === value.data.value,
                            ),
                        };
                    },
                )
                .concat(
                    state.selected
                        .map(
                            (
                                identifier: string,
                            ): SelectMenuComponentOptionData => {
                                const refPg = pages.indexOf(
                                    pages.find(
                                        (pg): Song =>
                                            pg.find(
                                                (t): boolean =>
                                                    t.info.identifier ===
                                                    identifier,
                                            ),
                                    ),
                                );
                                const firstIdx = 10 * refPg + 1;
                                const refTrack = pages[refPg].find(
                                    (t): boolean =>
                                        t.info.identifier === identifier,
                                );
                                let label = `${
                                    firstIdx + pages[refPg].indexOf(refTrack)
                                }. ${refTrack.info.title}`;
                                if (label.length >= 100) {
                                    label = `${label.substring(0, 99)}…`;
                                }
                                return {
                                    label: label,
                                    description: refTrack.info.author,
                                    value: identifier,
                                    default: true,
                                };
                            },
                        )
                        .filter(
                            (options): boolean =>
                                !selectMenuActionRow.components[0].options.find(
                                    (opt): boolean =>
                                        opt.data.value === options.value,
                                ),
                        ),
                )
                .sort(
                    (a, b): number =>
                        parseInt(a.label.split('.')[0]) -
                        parseInt(b.label.split('.')[0]),
                ),
        );
        container.components[3] = selectMenuActionRow;
        const buttonActionRow = ActionRowBuilder.from<ButtonBuilder>(
            container.components[4].toJSON() as APIActionRowComponent<APIButtonComponent>,
        );
        buttonActionRow.components[2] = ButtonBuilder.from(
            buttonActionRow.components[2].toJSON(),
        ).setDisabled(state.selected.length === 0);
        container.components[4] = buttonActionRow;
        await interaction.replyHandler.reply(container, {
            force: ForceType.Update,
        });
    },
};

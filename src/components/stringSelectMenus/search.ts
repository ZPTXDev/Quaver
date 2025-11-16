import type { Song } from '@lavaclient/plugin-queue';
import {
    ActionRowBuilder,
    type APIActionRowComponent,
    type APIButtonComponent,
    type APIStringSelectComponent,
    ButtonBuilder,
    ContainerBuilder,
    ContainerComponent,
    type SelectMenuComponentOptionData,
    StringSelectMenuBuilder,
    type StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ForceType, QuaverGuild } from '#src/lib';
import { StringSelectMenuHandler } from '#src/lib/builders';
import { logger, searchState } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { buildMessageOptions } from '#src/lib/util/util';

export default new StringSelectMenuHandler()
    .setChecks([Check.InteractionStarter])
    .setExecute(async function(interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const state = searchState[interaction.message.id];
        if (!state) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { components: [], force: ForceType.Update },
            );
            return;
        }
        clearTimeout(state.timeout);
        state.timeout = setTimeout(
            async (g, message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            g.locale('DISCORD.INTERACTION.EXPIRED'),
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
            guild,
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
    });

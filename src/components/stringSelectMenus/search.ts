import { ForceType } from '#src/lib';
import { StringSelectMenuHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import { searchState } from '#src/lib/state';
import { buildMessageOptions, Check } from '#src/lib/util';
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

export default new StringSelectMenuHandler()
    .setChecks([Check.InteractionStarter])
    .setExecute(async function (interaction): Promise<void> {
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
                        logger.error(`${error.message}\n${error.stack}`);
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
        const pageOptions = selectMenuActionRow.components[0].options.map(
            (
                value: StringSelectMenuOptionBuilder,
            ): SelectMenuComponentOptionData => {
                return {
                    label: value.data.label,
                    description: value.data.description,
                    value: value.data.value,
                    default: !!state.selected.find(
                        (id: string): boolean =>
                            id === value.data.value,
                    ),
                };
            },
        );
        // Cart items (selected from other pages) fill only remaining slots,
        // ensuring page items are always shown first when the 25-option cap is hit.
        const cartOptions = state.selected
            .map((id: string): SelectMenuComponentOptionData => {
                const refPg = pages.indexOf(
                    pages.find(
                        (pg): Song =>
                            pg.find((t): boolean => t.id === id),
                    ),
                );
                const firstIdx = 10 * refPg + 1;
                const refTrack = pages[refPg].find(
                    (t): boolean => t.id === id,
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
                    value: id,
                    default: true,
                };
            })
            .filter(
                (options): boolean =>
                    !selectMenuActionRow.components[0].options.find(
                        (opt): boolean =>
                            opt.data.value === options.value,
                    ),
            )
            .slice(0, 25 - pageOptions.length);
        const mergedOptions = pageOptions
            .concat(cartOptions)
            .sort(
                (a, b): number =>
                    parseInt(a.label.split('.')[0]) -
                    parseInt(b.label.split('.')[0]),
            );
        selectMenuActionRow.components[0] = StringSelectMenuBuilder.from(
            selectMenuActionRow.components[0].toJSON(),
        )
            .setOptions(mergedOptions)
            .setMaxValues(mergedOptions.length);
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

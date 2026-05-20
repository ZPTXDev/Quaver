import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { Check, formatSessionLog } from '#src/lib/util';
import { paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    ContainerComponent,
    ModalBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

export default new ButtonHandler().setExecute(
    async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const pages = player ? paginate(player.sessionLogs, 10) : [];
        const target = interaction.customId.split(':')[1];
        if (player && target === 'goto' && pages.length !== 0) {
            return interaction.showModal(
                new ModalBuilder()
                    .setTitle(guild.locale('CMD.QUEUE.MISC.MODAL_TITLE'))
                    .setCustomId('sessionlogs:goto')
                    .addLabelComponents(
                        guild.builders
                            .labelLocale('CMD.QUEUE.MISC.PAGE')
                            .setTextInputComponent(
                                new TextInputBuilder()
                                    .setCustomId('sessionlogs:goto:input')
                                    .setStyle(TextInputStyle.Short),
                            ),
                    ),
            );
        }
        const page = parseInt(target);
        if (!player || pages.length === 0 || page < 1 || page > pages.length) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.SESSIONLOGS.RESPONSE.NO_LOGS'),
                {
                    type: MessageOptionsBuilderType.Error,
                    components: [],
                    force: ForceType.Update,
                },
            );
            return;
        }
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { components: [], force: ForceType.Update },
            );
            return;
        }
        await interaction.replyHandler.reply(
            new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        pages[page - 1]
                            .map((log): string => formatSessionLog(log, (key, ...args) => guild.locale(key, ...args)))
                            .join('\n'),
                    ),
                    guild.builders.textDisplayLocale(
                        'MISC.PAGE',
                        page.toString(),
                        pages.length.toString(),
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`sessionlogs:${page - 1}`)
                            .setEmoji('⬅️')
                            .setDisabled(page - 1 < 1)
                            .setStyle(ButtonStyle.Primary),
                        guild.builders
                            .buttonLocale('MISC.GO_TO')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId('sessionlogs:goto'),
                        new ButtonBuilder()
                            .setCustomId(`sessionlogs:${page + 1}`)
                            .setEmoji('➡️')
                            .setDisabled(page + 1 > pages.length)
                            .setStyle(ButtonStyle.Primary),
                    ),
                ),
            { force: ForceType.Update },
        );
    },
);

import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ModalSubmitHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { formatSessionLog } from '#src/lib/util';
import { paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
} from 'discord.js';

export default new ModalSubmitHandler().setExecute(
    async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const page = parseInt(
            interaction.fields.getTextInputValue('sessionlogs:goto:input'),
        );
        let pages;
        if (isNaN(page)) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.QUEUE.RESPONSE.OUT_OF_RANGE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        if (player) pages = paginate(player.sessionLogs, 10);
        if (!player || pages?.length === 0) {
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
        if (page < 1 || page > pages.length) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.QUEUE.RESPONSE.OUT_OF_RANGE'),
                { type: MessageOptionsBuilderType.Error },
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
                    new ActionRowBuilder<ButtonBuilder>().setComponents(
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
        return;
    },
);

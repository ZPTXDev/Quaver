import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { Check, formatSessionLog, settings } from '#src/lib/util';
import { paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('sessionlogs')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.SESSIONLOGS.DESCRIPTION',
                ),
            ),
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        if (player.sessionLogs.length === 0) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.SESSIONLOGS.RESPONSE.NO_LOGS'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const pages = paginate(player.sessionLogs, 10);
        await interaction.replyHandler.reply(
            new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        pages[0]
                            .map((log): string => formatSessionLog(log, (key, ...args) => guild.locale(key, ...args)))
                            .join('\n'),
                    ),
                    guild.builders.textDisplayLocale(
                        'MISC.PAGE',
                        '1',
                        pages.length.toString(),
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().setComponents(
                        new ButtonBuilder()
                            .setCustomId('sessionlogs:0')
                            .setEmoji('⬅️')
                            .setDisabled(true)
                            .setStyle(ButtonStyle.Primary),
                        guild.builders
                            .buttonLocale('MISC.GO_TO')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId('sessionlogs:goto'),
                        new ButtonBuilder()
                            .setCustomId('sessionlogs:2')
                            .setEmoji('➡️')
                            .setDisabled(pages.length === 1)
                            .setStyle(ButtonStyle.Primary),
                    ),
                ),
            { ephemeral: true },
        );
    });

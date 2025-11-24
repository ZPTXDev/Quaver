import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { settings } from '#src/lib/util';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import { ContainerBuilder, SlashCommandBuilder } from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('ping')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.PING.DESCRIPTION',
                ),
            ),
    )
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const uptime = msToTime(interaction.client.uptime);
        const uptimeString = msToTimeString(uptime);
        await interaction.replyHandler.reply(
            new ContainerBuilder().addTextDisplayComponents(
                guild.builders.textDisplayLocale(
                    'CMD.PING.RESPONSE.SUCCESS',
                    interaction.guild
                        ? interaction.guild.shard.ping === -1
                            ? '👀⌛'
                            : `${interaction.guild.shard.ping}ms`
                        : '',
                ),
                guild.builders.textDisplayLocale(
                    'CMD.PING.MISC.UPTIME',
                    uptimeString,
                ),
            ),
            { ephemeral: true },
        );
    });

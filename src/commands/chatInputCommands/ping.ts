import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { settings } from '#src/lib/util';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import {
    ContainerBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';

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
        const guild = interaction.guild
            ? await QuaverGuild.wrap(interaction.guild)
            : undefined;
        const uptime = msToTime(interaction.client.uptime);
        const uptimeString = msToTimeString(uptime);
        await interaction.replyHandler.reply(
            new ContainerBuilder().addTextDisplayComponents(
                guild
                    ? guild.builders.textDisplayLocale(
                          'CMD.PING.RESPONSE.SUCCESS',
                          guild
                              ? guild.shard.ping === -1
                                  ? '👀⌛'
                                  : `${guild.shard.ping}ms`
                              : '',
                      )
                    : new TextDisplayBuilder().setContent(
                          getLocaleString(
                              settings.defaultLocaleCode ?? 'en',
                              'CMD.PING.RESPONSE.SUCCESS',
                              interaction.client.ws.ping === -1
                                  ? '👀⌛'
                                  : `${interaction.client.ws.ping}ms`,
                          ),
                      ),
                guild
                    ? guild.builders.textDisplayLocale(
                          'CMD.PING.MISC.UPTIME',
                          uptimeString,
                      )
                    : new TextDisplayBuilder().setContent(
                          getLocaleString(
                              settings.defaultLocaleCode ?? 'en',
                              'CMD.PING.MISC.UPTIME',
                              uptimeString,
                          ),
                      ),
            ),
            { ephemeral: true },
        );
    });

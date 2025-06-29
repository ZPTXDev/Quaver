import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import type { ChatInputCommandInteraction } from 'discord.js';
import {
    ContainerBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { data } from '#src/lib/util/common.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.PING.DESCRIPTION'),
        ),
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const uptime = msToTime(interaction.client.uptime);
        const uptimeString = msToTimeString(uptime);
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        await interaction.replyHandler.reply(
            new ContainerBuilder({
                components: [
                    new TextDisplayBuilder()
                        .setContent(
                            getLocaleString(
                                guildLocaleCode,
                                'CMD.PING.RESPONSE.SUCCESS',
                                interaction.guild
                                    ? interaction.guild.shard.ping === -1
                                        ? '👀⌛'
                                        : `${interaction.guild.shard.ping}ms`
                                    : '',
                            ),
                        )
                        .toJSON(),
                    new TextDisplayBuilder()
                        .setContent(
                            `${getLocaleString(
                                guildLocaleCode,
                                'CMD.PING.MISC.UPTIME',
                                uptimeString,
                            )}`,
                        )
                        .toJSON(),
                ],
            }),
            { ephemeral: true },
        );
    },
};

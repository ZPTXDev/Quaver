import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandBooleanOption,
} from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.247.DESCRIPTION'),
        )
        .addBooleanOption(
            (option): SlashCommandBooleanOption =>
                option
                    .setName('enabled')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.247.OPTION.ENABLED',
                        ),
                    ),
        ),
    checks: [
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const { io } = await import('#src/main.js');
        if (!settings.features.stay.enabled) {
            await interaction.replyHandler.locale('FEATURE.DISABLED.DEFAULT', {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
        if (
            settings.features.stay.whitelist &&
            !(await data.guild.get(
                interaction.guildId,
                'features.stay.whitelisted',
            ))
        ) {
            await interaction.replyHandler.locale(
                'CMD.247.RESPONSE.FEATURE_NOT_WHITELISTED',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        if (!player?.queue?.channel?.id) {
            const applicationCommands =
                interaction.client.application?.commands;
            if (applicationCommands.cache.size === 0) {
                await applicationCommands.fetch();
            }
            await interaction.replyHandler.locale(
                'CMD.247.RESPONSE.QUEUE_CHANNEL_MISSING',
                {
                    type: MessageOptionsBuilderType.Error,
                    vars: [
                        applicationCommands.cache.find(
                            (command): boolean => command.name === 'bind',
                        )?.id ?? '1',
                    ],
                },
            );
            return;
        }
        const enabled = interaction.options.getBoolean('enabled');
        const always =
            enabled !== null
                ? enabled
                : !(await data.guild.get(
                      interaction.guildId,
                      'settings.stay.enabled',
                  ));
        await data.guild.set(
            interaction.guildId,
            'settings.stay.enabled',
            always,
        );
        if (always) {
            await data.guild.set(
                interaction.guildId,
                'settings.stay.channel',
                player.channelId,
            );
            await data.guild.set(
                interaction.guildId,
                'settings.stay.text',
                player.queue.channel.id,
            );
        }
        if (player.timeout) {
            clearTimeout(player.timeout);
            delete player.timeout;
            if (settings.features.web.enabled) {
                io.to(`guild:${player.guildId}`).emit(
                    'timeoutUpdate',
                    !!player.timeout,
                );
            }
        }
        // pause timeout is theoretically impossible because the user would need to be in the same vc as Quaver
        // and pause timeout is only set when everyone leaves
        await interaction.replyHandler.reply(
            new EmbedBuilder()
                .setDescription(
                    await getGuildLocaleString(
                        interaction.guildId,
                        always
                            ? 'CMD.247.RESPONSE.ENABLED'
                            : 'CMD.247.RESPONSE.DISABLED',
                    ),
                )
                .setFooter({
                    text: always
                        ? await getGuildLocaleString(
                              interaction.guildId,
                              'CMD.247.MISC.NOTE',
                          )
                        : null,
                }),
        );
        if (!always && !player.playing) player.queue.emit('finish');
    },
};

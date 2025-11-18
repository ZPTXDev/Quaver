import {
    ChannelType,
    SlashCommandBuilder,
    type SlashCommandChannelOption,
} from 'discord.js';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { PlayerResponse } from '#src/lib/music';
import { Check } from '#src/lib/util/constants';
import { MessageOptionsBuilderType } from '#src/lib/util/common';
import type { QuaverChannels } from '#src/lib/util/common.d';
import { settings } from '#src/lib/util/settings';
import { getLocaleString } from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('bind')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.BIND.DESCRIPTION',
                ),
            )
            .addChannelOption(
                (option): SlashCommandChannelOption =>
                    option
                        .setName('new_channel')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.BIND.OPTION.NEW_CHANNEL',
                            ),
                        )
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildVoice,
                        )
                        .setRequired(true),
            ),
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function(interaction): Promise<void> {
        const channel = interaction.options.getChannel(
            'new_channel',
        ) as QuaverChannels;
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const response = await player.bindTextChannel(channel);
        switch (response) {
            case PlayerResponse.InsufficientPermissions:
                await interaction.replyHandler.reply(
                    guild.locale(
                        'CMD.BIND.RESPONSE.PERMISSIONS_INSUFFICIENT',
                        channel.id,
                    ),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success:
                player.queue.channel = channel;
                guild.sendWebUpdate('textChannelUpdate', channel.name);
                if (await guild.settings.get('stay.enabled')) {
                    await guild.settings.set('stay.text', channel.id);
                }
                await interaction.replyHandler.reply(
                    guild.locale('CMD.BIND.RESPONSE.SUCCESS', channel.id),
                    { type: MessageOptionsBuilderType.Success },
                );
        }
    });

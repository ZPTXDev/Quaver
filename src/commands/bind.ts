import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverChannels,
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandChannelOption,
} from 'discord.js';
import { ChannelType, SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bind')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.BIND.DESCRIPTION'),
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
        const channel = interaction.options.getChannel(
            'new_channel',
        ) as QuaverChannels;
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        const response = await player.handler.bind(channel);
        switch (response) {
            case PlayerResponse.InsufficientPermissions:
                await interaction.replyHandler.locale(
                    'CMD.BIND.RESPONSE.PERMISSIONS_INSUFFICIENT',
                    {
                        vars: [channel.id],
                        type: MessageOptionsBuilderType.Error,
                    },
                );
                return;
            case PlayerResponse.Success:
                player.queue.channel = channel;
                if (settings.features.web.enabled) {
                    io.to(`guild:${interaction.guildId}`).emit(
                        'textChannelUpdate',
                        channel.name,
                    );
                }
                if (
                    await data.guild.get(
                        interaction.guildId,
                        'settings.stay.enabled',
                    )
                ) {
                    await data.guild.set(
                        interaction.guildId,
                        'settings.stay.text',
                        channel.id,
                    );
                }
                await interaction.replyHandler.locale(
                    'CMD.BIND.RESPONSE.SUCCESS',
                    {
                        vars: [channel.id],
                        type: MessageOptionsBuilderType.Success,
                    },
                );
        }
    },
};

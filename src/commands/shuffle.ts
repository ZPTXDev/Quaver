import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.SHUFFLE.DESCRIPTION',
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
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        const response = await player.handler.shuffle();
        switch (response) {
            case PlayerResponse.QueueInsufficientTracks:
                await interaction.replyHandler.locale(
                    'CMD.SHUFFLE.RESPONSE.QUEUE_INSUFFICIENT_TRACKS',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.locale(
                    'CMD.SHUFFLE.RESPONSE.SUCCESS',
                    {
                        type: MessageOptionsBuilderType.Success,
                    },
                );
        }
    },
};

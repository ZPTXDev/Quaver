import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandIntegerOption,
} from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.VOLUME.DESCRIPTION',
            ),
        )
        .addIntegerOption(
            (option): SlashCommandIntegerOption =>
                option
                    .setName('new_volume')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.VOLUME.OPTION.NEW_VOLUME',
                        ),
                    )
                    .setMinValue(0)
                    .setMaxValue(200)
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
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        const volume = interaction.options.getInteger('new_volume');
        if (volume > 200) {
            await interaction.replyHandler.locale(
                'CMD.VOLUME.RESPONSE.OUT_OF_RANGE',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const response = await player.handler.volume(volume);
        if (response !== PlayerResponse.Success) return;
        await interaction.replyHandler.reply(
            new EmbedBuilder()
                .setDescription(
                    await getGuildLocaleString(
                        interaction.guildId,
                        'CMD.VOLUME.RESPONSE.SUCCESS',
                        volume.toString(),
                    ),
                )
                .setFooter({
                    text: await getGuildLocaleString(
                        interaction.guildId,
                        'MUSIC.PLAYER.FILTER_NOTE',
                    ),
                }),
        );
    },
};

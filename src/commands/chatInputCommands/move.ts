import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { cleanURIForMarkdown, getLocaleString } from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandIntegerOption,
} from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.MOVE.DESCRIPTION'),
        )
        .addIntegerOption(
            (option): SlashCommandIntegerOption =>
                option
                    .setName('old_position')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.MOVE.OPTION.OLD_POSITION',
                        ),
                    )
                    .setMinValue(1)
                    .setRequired(true)
                    .setAutocomplete(true),
        )
        .addIntegerOption(
            (option): SlashCommandIntegerOption =>
                option
                    .setName('new_position')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.MOVE.OPTION.NEW_POSITION',
                        ),
                    )
                    .setMinValue(1)
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
        const player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        const oldPosition = interaction.options.getInteger('old_position');
        const newPosition = interaction.options.getInteger('new_position');
        const response = await player.handler.move(oldPosition, newPosition);
        switch (response) {
            case PlayerResponse.QueueInsufficientTracks:
                await interaction.replyHandler.locale(
                    'CMD.MOVE.RESPONSE.QUEUE_INSUFFICIENT_TRACKS',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.locale(
                    'CMD.MOVE.RESPONSE.OUT_OF_RANGE',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputInvalid:
                await interaction.replyHandler.locale(
                    'CMD.MOVE.RESPONSE.MOVING_IN_PLACE',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success: {
                const track = player.queue.tracks[newPosition - 1];
                await interaction.replyHandler.locale(
                    track.info.title === track.info.uri
                        ? 'CMD.MOVE.RESPONSE.SUCCESS_DIRECT_LINK'
                        : 'CMD.MOVE.RESPONSE.SUCCESS',
                    {
                        vars: [
                            ...(track.info.title !== track.info.uri
                                ? [cleanURIForMarkdown(track.info.title)]
                                : []),
                            track.info.uri,
                            oldPosition.toString(),
                            newPosition.toString(),
                        ],
                        type: MessageOptionsBuilderType.Success,
                    },
                );
            }
        }
    },
};

import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import { Check, getTrackMarkdownLocaleString, settings } from '#src/lib/util';
import {
    SlashCommandBuilder,
    type SlashCommandIntegerOption,
} from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('move')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.MOVE.DESCRIPTION',
                ),
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
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function (interaction): Promise<void> {
        const oldPosition = interaction.options.getInteger('old_position');
        const newPosition = interaction.options.getInteger('new_position');
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const response = await player.moveQueuedTrack(oldPosition, newPosition);
        switch (response) {
            case PlayerResponse.QueueInsufficientTracks:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.MOVE.RESPONSE.QUEUE_INSUFFICIENT_TRACKS'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.MOVE.RESPONSE.OUT_OF_RANGE'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputInvalid:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.MOVE.RESPONSE.MOVING_IN_PLACE'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success: {
                const track = player.queue.tracks[newPosition - 1];
                await interaction.replyHandler.reply(
                    guild.locale(
                        'CMD.MOVE.RESPONSE.SUCCESS',
                        getTrackMarkdownLocaleString(track),
                        oldPosition.toString(),
                        newPosition.toString(),
                    ),
                    { type: MessageOptionsBuilderType.Success },
                );
            }
        }
    });

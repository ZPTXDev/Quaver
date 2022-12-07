import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    getLocaleString,
    getRequesterStatus,
    RequesterStatus,
} from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    GuildMember,
    SlashCommandIntegerOption,
} from 'discord.js';
import { escapeMarkdown, SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.REMOVE.DESCRIPTION',
            ),
        )
        .addIntegerOption(
            (option): SlashCommandIntegerOption =>
                option
                    .setName('position')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.REMOVE.OPTION.POSITION',
                        ),
                    )
                    .setMinValue(1)
                    .setRequired(true)
                    .setAutocomplete(true),
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
        const position = interaction.options.getInteger('position');
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        const track = player.queue.tracks[position - 1];
        const requesterStatus = await getRequesterStatus(
            track,
            interaction.member as GuildMember,
            player.queue.channel,
        );
        if (requesterStatus === RequesterStatus.NotRequester) {
            await interaction.replyHandler.locale('CHECK.NOT_REQUESTER', {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
        const response = await player.handler.remove(position);
        switch (response) {
            case PlayerResponse.QueueInsufficientTracks:
                await interaction.replyHandler.locale(
                    'CMD.REMOVE.RESPONSE.QUEUE_EMPTY',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.locale('CHECK.INVALID_INDEX', {
                    type: MessageOptionsBuilderType.Error,
                });
                return;
            default:
                await interaction.replyHandler.locale(
                    requesterStatus === RequesterStatus.Requester
                        ? 'CMD.REMOVE.RESPONSE.SUCCESS.DEFAULT'
                        : requesterStatus === RequesterStatus.ManagerBypass
                        ? 'CMD.REMOVE.RESPONSE.SUCCESS.MANAGER'
                        : 'CMD.REMOVE.RESPONSE.SUCCESS.FORCED',
                    {
                        vars: [escapeMarkdown(track.title), track.uri],
                        type: MessageOptionsBuilderType.Success,
                    },
                );
        }
    },
};

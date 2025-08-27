import type {
    ChatInputCommandInteraction,
    GuildMember,
    SlashCommandIntegerOption,
} from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import {
    getLocaleString,
    getRequesterStatus,
    getTrackMarkdownLocaleString,
    RequesterStatus,
} from '#src/lib/util/util.js';
import { settings } from '#src/lib/util/settings.js';
import { Check } from '#src/lib/util/constants.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { PlayerResponse } from '#src/lib/PlayerHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('skipto')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.SKIPTO.DESCRIPTION',
            ),
        )
        .addIntegerOption(
            (option): SlashCommandIntegerOption =>
                option
                    .setName('position')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.SKIPTO.OPTION.POSITION',
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
        const player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        const position = interaction.options.getInteger('position');
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.locale(
                'MUSIC.PLAYER.PLAYING.NOTHING',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const track = player.queue.current;
        const requesterStatus = await getRequesterStatus(
            track,
            interaction.member as GuildMember,
            player.queue.channel,
        );
        if (requesterStatus === RequesterStatus.NotRequester) {
            await interaction.replyHandler.locale(
                'CMD.SKIPTO.RESPONSE.NOT_REQUESTER',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const response = await player.handler.skipTo(position);
        switch (response) {
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.locale(
                    'MUSIC.PLAYER.PLAYING.NOTHING',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.locale(
                    'CMD.SKIPTO.RESPONSE.OUT_OF_RANGE',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success: {
                const movedTrack = player.queue.current;
                await interaction.replyHandler.locale(
                    requesterStatus === RequesterStatus.Requester
                        ? 'CMD.SKIPTO.RESPONSE.SUCCESS.DEFAULT'
                        : requesterStatus === RequesterStatus.ManagerBypass
                          ? 'CMD.SKIPTO.RESPONSE.SUCCESS.MANAGER'
                          : 'CMD.SKIPTO.RESPONSE.SUCCESS.FORCED',
                    {
                        vars: [
                            getTrackMarkdownLocaleString(track),
                            getTrackMarkdownLocaleString(movedTrack),
                        ],
                    },
                );
            }
        }
    },
};

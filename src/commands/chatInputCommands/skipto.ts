import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import {
    Check,
    getRequesterStatus,
    getTrackMarkdownLocaleString,
    RequesterStatus,
    settings,
} from '#src/lib/util';
import {
    type GuildMember,
    SlashCommandBuilder,
    type SlashCommandIntegerOption,
} from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
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
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const position = interaction.options.getInteger('position');
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
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
            await interaction.replyHandler.reply(
                guild.locale('CMD.SKIPTO.RESPONSE.NOT_REQUESTER'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const response = await player.skipToQueuedTrack(position);
        switch (response) {
            case PlayerResponse.RestartInProgress:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.SKIPTO.RESPONSE.OUT_OF_RANGE'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success: {
                const movedTrack = player.queue.current;
                await interaction.replyHandler.reply(
                    guild.locale(
                        requesterStatus === RequesterStatus.Requester
                            ? 'CMD.SKIPTO.RESPONSE.SUCCESS.DEFAULT'
                            : requesterStatus === RequesterStatus.ManagerBypass
                              ? 'CMD.SKIPTO.RESPONSE.SUCCESS.MANAGER'
                              : 'CMD.SKIPTO.RESPONSE.SUCCESS.FORCED',
                        getTrackMarkdownLocaleString(track),
                        getTrackMarkdownLocaleString(movedTrack),
                    ),
                );
            }
        }
    });

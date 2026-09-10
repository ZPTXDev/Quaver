import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import { Check, getTrackMarkdownLocaleString, settings } from '#src/lib/util';
import { SlashCommandBuilder } from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('previous')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.PREVIOUS.DESCRIPTION',
                ),
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

        const response = await player.playPreviousTrack(interaction.user);
        switch (response) {
            case PlayerResponse.RestartInProgress:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.AdPlaying:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.PREVIOUS.RESPONSE.ERROR.AD_PLAYING'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.NoPreviousTracks:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.PREVIOUS.RESPONSE.NO_PREVIOUS_TRACKS'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success: {
                const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
                const track = player.queue.current;
                if (!track) {
                    await interaction.replyHandler.reply(
                        guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                }

                // Check if this was an autoplayed track
                const wasAutoplayTrack = track.wasAutoplay === true;

                await interaction.replyHandler.reply(
                    `${guild.locale(
                        'CMD.PREVIOUS.RESPONSE.SUCCESS',
                        getTrackMarkdownLocaleString(track, showArtist),
                    )}\n${wasAutoplayTrack ? '**Auto-played track**' : guild.locale(
                        'MISC.ADDED_BY',
                        track.requesterId,
                    )}`,
                );
            }
        }
    });

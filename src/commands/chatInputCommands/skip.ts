import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    RequesterStatus,
    getGuildLocaleString,
    getLocaleString,
    getRequesterStatus,
} from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommandBuilder, escapeMarkdown } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.SKIP.DESCRIPTION'),
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
        // this check already occurs in the PlayerHandler#skip() method, but we do it first as we need to check before running voteskip addition etc
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
            const skip = player.skip ?? {
                required: Math.ceil(
                    (
                        interaction.member as GuildMember
                    ).voice.channel.members.filter((m): boolean => !m.user.bot)
                        .size / 2,
                ),
                users: [],
            };
            if (skip.users.includes(interaction.user.id)) {
                await interaction.replyHandler.locale(
                    'CMD.SKIP.RESPONSE.VOTED.STATE_UNCHANGED',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            skip.users.push(interaction.user.id);
            if (skip.users.length >= skip.required) {
                const response = await player.handler.skip();
                switch (response) {
                    case PlayerResponse.PlayerIdle:
                        await interaction.replyHandler.locale(
                            'MUSIC.PLAYER.PLAYING.NOTHING',
                            { type: MessageOptionsBuilderType.Error },
                        );
                        return;
                    case PlayerResponse.Success:
                        await interaction.replyHandler.reply(
                            `${await getGuildLocaleString(
                                interaction.guildId,
                                'CMD.SKIP.RESPONSE.SUCCESS.VOTED',
                                escapeMarkdown(track.info.title),
                                track.info.uri,
                            )}\n${await getGuildLocaleString(
                                interaction.guildId,
                                'MISC.ADDED_BY',
                                track.requesterId,
                            )}`,
                        );
                }
                return;
            }
            player.skip = skip;
            await interaction.replyHandler.locale(
                'CMD.SKIP.RESPONSE.VOTED.SUCCESS',
                {
                    vars: [
                        escapeMarkdown(track.info.title),
                        track.info.uri,
                        skip.users.length.toString(),
                        skip.required.toString(),
                    ],
                    type: MessageOptionsBuilderType.Success,
                },
            );
            return;
        }
        const response = await player.handler.skip();
        switch (response) {
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.locale(
                    'MUSIC.PLAYER.PLAYING.NOTHING',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.reply(
                    `${await getGuildLocaleString(
                        interaction.guildId,
                        requesterStatus === RequesterStatus.Requester
                            ? 'CMD.SKIP.RESPONSE.SUCCESS.DEFAULT'
                            : requesterStatus === RequesterStatus.ManagerBypass
                              ? 'CMD.SKIP.RESPONSE.SUCCESS.MANAGER'
                              : 'CMD.SKIP.RESPONSE.SUCCESS.FORCED',
                        escapeMarkdown(track.info.title),
                        track.info.uri,
                    )}${
                        requesterStatus !== RequesterStatus.Requester
                            ? `\n${await getGuildLocaleString(
                                  interaction.guildId,
                                  'MISC.ADDED_BY',
                                  track.requesterId,
                              )}`
                            : ''
                    }`,
                );
        }
    },
};

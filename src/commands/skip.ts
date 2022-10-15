import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { escapeMarkdown, SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.SKIP.DESCRIPTION'),
        ),
    checks: [
        checks.GUILD_ONLY,
        checks.ACTIVE_SESSION,
        checks.IN_VOICE,
        checks.IN_SESSION_VOICE,
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
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.locale(
                'MUSIC.PLAYER.PLAYING.NOTHING',
                { type: 'error' },
            );
            return;
        }
        if (player.queue.current.requester === interaction.user.id) {
            const track = await player.queue.skip();
            await player.queue.start();
            await interaction.replyHandler.locale(
                'CMD.SKIP.RESPONSE.SUCCESS.DEFAULT',
                {
                    vars: [escapeMarkdown(track.title), track.uri],
                    type: 'success',
                },
            );
            return;
        }
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
                { type: 'error' },
            );
            return;
        }
        skip.users.push(interaction.user.id);
        if (skip.users.length >= skip.required) {
            const track = await player.queue.skip();
            await player.queue.start();
            await interaction.replyHandler.reply(
                `${await getGuildLocaleString(
                    interaction.guildId,
                    'CMD.SKIP.RESPONSE.SUCCESS.VOTED',
                    escapeMarkdown(track.title),
                    track.uri,
                )}\n${await getGuildLocaleString(
                    interaction.guildId,
                    'MISC.ADDED_BY',
                    track.requester,
                )}`,
            );
            await player.queue.next();
            return;
        }
        player.skip = skip;
        await interaction.replyHandler.locale(
            'CMD.SKIP.RESPONSE.VOTED.SUCCESS',
            {
                vars: [
                    escapeMarkdown(player.queue.current.title),
                    player.queue.current.uri,
                    skip.users.length.toString(),
                    skip.required.toString(),
                ],
                type: 'success',
            },
        );
    },
};

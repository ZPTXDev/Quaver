import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import type {
    APIEmbedField,
    ChatInputCommandInteraction,
    SlashCommandStringOption,
} from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import Genius from 'genius-lyrics';

export default {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.LYRICS.DESCRIPTION',
            ),
        )
        .addStringOption(
            (option): SlashCommandStringOption =>
                option
                    .setName('query')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.LYRICS.OPTION.QUERY',
                        ),
                    ),
        ),
    checks: [],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        let query = interaction.options.getString('query');
        if (!query) {
            const player = interaction.guildId
                ? interaction.client.music.players.get(interaction.guildId)
                : null;
            if (
                !interaction.guildId ||
                !player?.queue.current ||
                (!player?.playing && !player?.paused)
            ) {
                await interaction.replyHandler.locale(
                    'CMD.LYRICS.RESPONSE.NO_QUERY',
                    { type: 'error' },
                );
                return;
            }
            query = player.queue.current.title;
        }
        await interaction.deferReply();
        const Client = new Genius.Client(settings.geniusToken ?? '');
        const searches = await Client.songs.search(query);
        if (searches.length === 0) {
            await interaction.replyHandler.locale(
                'CMD.LYRICS.RESPONSE.NO_RESULTS',
                {
                    type: 'error',
                },
            );
            return;
        }
        const song = searches[0];
        const lyrics = await song.lyrics();
        let lyricsFields: APIEmbedField[] = [];
        // try method 1
        let giveUp = false;
        lyrics.split('\n\n').reduce((previous, chunk, index, array): string => {
            if (giveUp) return;
            if (chunk.length > 1024) giveUp = true;
            if (previous.length + chunk.length > 1024) {
                lyricsFields.push({
                    name: lyricsFields.length === 0 ? song.title : '​',
                    value: previous,
                });
                return chunk;
            }
            if (index === array.length - 1) {
                lyricsFields.push({
                    name: lyricsFields.length === 0 ? song.title : '​',
                    value: previous + '\n\n' + chunk,
                });
            }
            return previous + '\n\n' + chunk;
        });
        if (giveUp) {
            lyricsFields = [];
            // try method 2
            lyrics
                .split('\n')
                .reduce((previous, line, index, array): string => {
                    if (previous.length + line.length > 1024) {
                        lyricsFields.push({
                            name: lyricsFields.length === 0 ? song.title : '​',
                            value: previous,
                        });
                        return line;
                    }
                    if (index === array.length - 1) {
                        lyricsFields.push({
                            name: lyricsFields.length === 0 ? song.title : '​',
                            value: previous + '\n' + line,
                        });
                    }
                    return previous + '\n' + line;
                }, '');
        }
        if (
            lyricsFields.reduce(
                (previous, current): number => previous + current.value.length,
                0,
            ) > 6000
        ) {
            let exceedIndex = -1;
            lyricsFields.reduce((previous, current, index): number => {
                if (exceedIndex !== -1) return;
                if (previous + current.value.length > 6000) {
                    exceedIndex = index;
                }
                return previous + current.value.length;
            }, 0);
            lyricsFields = lyricsFields.slice(0, exceedIndex);
            lyricsFields.push({ name: '​', value: '`...`' });
        }
        await interaction.replyHandler.reply(
            new EmbedBuilder().setFields(lyricsFields),
        );
    },
};
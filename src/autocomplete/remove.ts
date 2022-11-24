import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import type {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
    Snowflake,
} from 'discord.js';

export default {
    name: 'remove',
    async execute(
        interaction: QuaverInteraction<AutocompleteInteraction>,
    ): Promise<void> {
        const focused = interaction.options.getFocused();
        const player = interaction.client.music.players.get(
            interaction.guildId,
        );
        if (!player) return interaction.respond([]);
        return interaction.respond(
            player.queue.tracks
                .map(
                    (
                        track,
                        index,
                    ): ApplicationCommandOptionChoiceData & {
                        title: string;
                        requester: Snowflake;
                    } => ({
                        name: `${index + 1}. ${track.title}`,
                        value: index + 1,
                        title: track.title,
                        requester: track.requester,
                    }),
                )
                .filter(
                    (track): boolean =>
                        track.requester === interaction.user.id &&
                        track.title
                            .toLowerCase()
                            .startsWith(focused.toLowerCase()),
                )
                .map(
                    (track): ApplicationCommandOptionChoiceData => ({
                        name:
                            track.name.length >= 100
                                ? `${track.name.substring(0, 97)}...`
                                : track.name,
                        value: track.value,
                    }),
                )
                .slice(0, 25),
        );
    },
};

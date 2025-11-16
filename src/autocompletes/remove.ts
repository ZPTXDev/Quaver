import type {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
    Snowflake,
} from 'discord.js';
import { QuaverGuild } from '#src/lib';
import { AutocompleteHandler } from '#src/lib/builders';
import type { QuaverInteraction } from '#src/lib/util/common.d';

export default new AutocompleteHandler().setExecute(async function(
    interaction: QuaverInteraction<AutocompleteInteraction>,
): Promise<void> {
    const focused = interaction.options.getFocused();
    const guild = await QuaverGuild.wrap(interaction.guild);
    const player = await guild.getPlayer();
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
                    name: `${index + 1}. ${track.info.title}`,
                    value: index + 1,
                    title: track.info.title,
                    requester: track.requesterId,
                }),
            )
            .filter(
                (track): boolean =>
                    track.requester === interaction.user.id &&
                    track.title.toLowerCase().startsWith(focused.toLowerCase()),
            )
            .map(
                (track): ApplicationCommandOptionChoiceData => ({
                    name:
                        track.name.length >= 100
                            ? `${track.name.substring(0, 99)}…`
                            : track.name,
                    value: track.value,
                }),
            )
            .slice(0, 25),
    );
});

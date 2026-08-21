import { AutocompleteHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import type { QuaverInteraction } from '#src/lib/interactions';
import type {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
    Snowflake,
} from 'discord.js';

export default new AutocompleteHandler().setExecute(async function (
    interaction: QuaverInteraction<AutocompleteInteraction>,
): Promise<void> {
    try {
        const focused = interaction.options.getFocused();
        if (!interaction.guild) {
            await interaction.respond([]);
            return;
        }
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        if (!player) {
            await interaction.respond([]);
            return;
        }
        await interaction.respond(
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
    } catch (error) {
        // Silently handle "Unknown interaction" errors caused by expired autocomplete interactions (>3s timeout)
        // This prevents unhandled rejections that would crash the bot
        if (error instanceof Error && error.message.includes('Unknown interaction')) {
            return;
        }
        // Re-throw other unexpected errors
        throw error;
    }
});

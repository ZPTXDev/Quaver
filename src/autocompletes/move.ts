import type { ApplicationCommandOptionChoiceData } from 'discord.js';
import { QuaverGuild } from '#src/lib';
import { AutocompleteHandler } from '#src/lib/builders';

export default new AutocompleteHandler().setExecute(
    async function(interaction): Promise<void> {
        const focused = interaction.options.getFocused();
        // no usage of locale, so no need to run updateLocaleCode
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
                    } => ({
                        name: `${index + 1}. ${track.info.title}`,
                        value: index + 1,
                        title: track.info.title,
                    }),
                )
                .filter((track): boolean =>
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
    },
);

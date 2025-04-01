import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import type {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
} from 'discord.js';
import { request } from 'undici';

export default {
    name: 'play',
    async execute(
        interaction: QuaverInteraction<AutocompleteInteraction>,
    ): Promise<void> {
        const focused = interaction.options.getFocused();
        const { body } = await request(
            `https://clients1.google.com/complete/search?client=youtube&gs_ri=youtube&ds=yt&q=${focused}`,
        );
        let data;
        try {
            data = await body.text();
            let searchSuggestions: string[] = [];
            data.split('[').forEach((element: string, index: number): void => {
                if (!element.split('"')[1] || index === 1) return;
                searchSuggestions.push(element.split('"')[1]);
            });
            searchSuggestions.pop();
            searchSuggestions = searchSuggestions.filter(
                (element): boolean => element !== focused,
            );
            searchSuggestions.unshift(focused);
            return await interaction.respond(
                searchSuggestions
                    .filter((element): boolean => element !== '')
                    .map((suggestion): string =>
                        suggestion.replace(
                            /\\u([0-9a-fA-F]{4})/g,
                            (_whole, grp): string =>
                                String.fromCharCode(parseInt(grp, 16)),
                        ),
                    )
                    .filter((suggestion): boolean => suggestion.length <= 100)
                    .map(
                        (suggestion): ApplicationCommandOptionChoiceData => ({
                            name: suggestion,
                            value: suggestion,
                        }),
                    )
                    .slice(0, 25),
            );
        } catch {
            return interaction.respond([]);
        }
    },
};

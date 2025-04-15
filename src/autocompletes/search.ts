import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import type {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
} from 'discord.js';
import { request } from 'undici';
import { YOUTUBE_AUTOCOMPLETE_URL } from '#src/lib/util/constants.js';

export default {
    name: 'search',
    async execute(
        interaction: QuaverInteraction<AutocompleteInteraction>,
    ): Promise<void> {
        const focused = interaction.options.getFocused();
        const { body } = await request(`${YOUTUBE_AUTOCOMPLETE_URL}${focused}`);
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
                        suggestion
                            .replace(
                                /\\u([0-9a-fA-F]{4})/g,
                                (_whole, grp): string =>
                                    String.fromCharCode(parseInt(grp, 16)),
                            )
                            .slice(0, 100),
                    )
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

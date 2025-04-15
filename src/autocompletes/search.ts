import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import type {
    ApplicationCommandOptionChoiceData,
    AutocompleteInteraction,
} from 'discord.js';
import { request } from 'undici';
import { YOUTUBE_AUTOCOMPLETE_URL } from '#src/lib/util/constants.js';
import { cache } from '#src/lib/util/common.js';

export default {
    name: 'search',
    async execute(
        interaction: QuaverInteraction<AutocompleteInteraction>,
    ): Promise<void> {
        const focused = interaction.options.getFocused();
        if (focused === '') return interaction.respond([]);
        const existingResults = await cache.get(focused.toLowerCase());
        if (existingResults) {
            const searchSuggestionsResponse =
                existingResults as ApplicationCommandOptionChoiceData[];
            searchSuggestionsResponse.unshift({
                name: focused,
                value: focused,
            });
            return interaction.respond(searchSuggestionsResponse);
        }
        const { body } = await request(
            `${YOUTUBE_AUTOCOMPLETE_URL}${focused.toLowerCase()}`,
        );
        let autocompleteData;
        try {
            autocompleteData = await body.text();
            const searchSuggestions: string[] = [];
            autocompleteData
                .split('[')
                .forEach((element: string, index: number): void => {
                    if (!element.split('"')[1] || index === 1) return;
                    searchSuggestions.push(element.split('"')[1]);
                });
            // removes the last element, which is a random 'k' in my testing
            searchSuggestions.pop();
            const searchSuggestionsResponse = searchSuggestions
                .filter(
                    (element): boolean => element !== focused && element !== '',
                )
                .map((suggestion): string =>
                    suggestion
                        .replace(
                            /\\u([0-9a-fA-F]{4})/g,
                            (_whole, grp): string =>
                                String.fromCharCode(parseInt(grp, 16)),
                        )
                        .slice(0, 100),
                )
                .slice(0, 24)
                .map(
                    (suggestion): ApplicationCommandOptionChoiceData => ({
                        name: suggestion,
                        value: suggestion,
                    }),
                );
            await cache.set(focused.toLowerCase(), searchSuggestionsResponse);
            searchSuggestionsResponse.unshift({
                name: focused,
                value: focused,
            });
            return await interaction.respond(searchSuggestionsResponse);
        } catch {
            return interaction.respond([]);
        }
    },
};

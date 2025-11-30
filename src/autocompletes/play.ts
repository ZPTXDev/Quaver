import { AutocompleteHandler } from '#src/lib/builders';
import { data } from '#src/lib/data';
import { QuaverGuild } from '#src/lib/guild';
import type { LocaleKey } from '#src/lib/locales';
import {
    acceptableSources,
    queryOverrides,
    sourceList,
    YOUTUBE_AUTOCOMPLETE_URL,
} from '#src/lib/util';
import type { ApplicationCommandOptionChoiceData } from 'discord.js';
import { request } from 'undici';

export default new AutocompleteHandler().setExecute(
    async function (interaction): Promise<void> {
        const focused = interaction.options.getFocused();
        if (focused === '') return interaction.respond([]);
        const guild = await QuaverGuild.wrap(interaction.guild);
        const matchingOverride = queryOverrides.find((q): boolean =>
            focused.startsWith(q),
        );
        const source = matchingOverride
            ? sourceList[matchingOverride]
            : ((await guild.settings.get<string>('source')) ??
              Object.keys(acceptableSources)[0]);
        const sourceName = guild.locale(
            `MISC.SOURCES.${source.toUpperCase()}` as LocaleKey,
        );
        const query = matchingOverride
            ? focused.slice(matchingOverride.length)
            : focused;
        const existingResults = await data.cache.get(query.toLowerCase());
        if (existingResults) {
            const searchSuggestionsResponse =
                existingResults as ApplicationCommandOptionChoiceData[];
            searchSuggestionsResponse.unshift({
                name: `${sourceName}: ${query}`,
                value: focused,
            });
            return interaction.respond(searchSuggestionsResponse);
        }
        const { body } = await request(
            `${YOUTUBE_AUTOCOMPLETE_URL}${query.toLowerCase()}`,
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
                .map(
                    (suggestion): string =>
                        `${suggestion
                            .replace(
                                /\\u([0-9a-fA-F]{4})/g,
                                (_whole, grp): string =>
                                    String.fromCharCode(parseInt(grp, 16)),
                            )
                            .slice(
                                0,
                                suggestion.length > 100 ? 99 : 100,
                            )}${suggestion.length > 100 ? '…' : ''}`,
                )
                .slice(0, 24)
                .map(
                    (suggestion): ApplicationCommandOptionChoiceData => ({
                        name: suggestion,
                        value: suggestion,
                    }),
                );
            await data.cache.set(
                query.toLowerCase(),
                searchSuggestionsResponse,
            );
            searchSuggestionsResponse.unshift({
                name: `${sourceName}: ${query}`,
                value: focused,
            });
            return await interaction.respond(searchSuggestionsResponse);
        } catch {
            return interaction.respond([]);
        }
    },
);

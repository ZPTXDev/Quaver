import type { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';

export type ChatInputCommand = {
    data?: SlashCommandBuilder;
    checks?: string[];
    permissions?: { user: bigint[], bot: bigint[] };
    execute?(interaction: ChatInputCommandInteraction): Promise<void>;
};

export type Autocomplete = {
    execute(interaction: AutocompleteInteraction): Promise<void>;
};

export type Button = {
    execute(interaction: ButtonInteraction): Promise<void>;
};

export type SelectMenu = {
    execute(interaction: SelectMenuInteraction): Promise<void>;
};

export type ModalSubmit = {
    execute(interaction: ModalSubmitInteraction): Promise<void>;
};

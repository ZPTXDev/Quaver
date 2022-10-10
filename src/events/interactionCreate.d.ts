import type { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, PermissionsBitField, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';

export type ChatInputCommand = {
	data?: SlashCommandBuilder;
	checks?: string[];
	permissions?: { user: PermissionsBitField[], bot: PermissionsBitField[] };
	execute?(interaction: ChatInputCommandInteraction): Promise<void>;
};

export type Autocomplete = {
	name: string;
	execute(interaction: AutocompleteInteraction): Promise<void>;
};

export type Button = {
	name: string;
	execute(interaction: ButtonInteraction): Promise<void>;
};

export type SelectMenu = {
	name: string;
	execute(interaction: SelectMenuInteraction): Promise<void>;
};

export type ModalSubmit = {
	name: string;
	execute(interaction: ModalSubmitInteraction): Promise<void>;
};

import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('disconnect')
		.setDescription(getLocale(defaultLocale, 'CMD.DISCONNECT.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (await data.guild.get(interaction.guildId, 'settings.stay.enabled')) {
			await interaction.replyHandler.locale('CMD.DISCONNECT.RESPONSE.FEATURE_247_ENABLED', {}, 'error');
			return;
		}
		const player = interaction.client.music.players.get(interaction.guildId);
		await player.handler.disconnect();
		await interaction.replyHandler.locale('CMD.DISCONNECT.RESPONSE.SUCCESS', {}, 'success');
	},
};

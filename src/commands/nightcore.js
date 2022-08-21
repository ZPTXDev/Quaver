import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('nightcore')
		.setDescription(getLocale(defaultLocale, 'CMD.NIGHTCORE.DESCRIPTION'))
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription(getLocale(defaultLocale, 'CMD.NIGHTCORE.OPTION.ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		const enabled = interaction.options.getBoolean('enabled');
		let nightcore;
		if (enabled !== null) {
			nightcore = enabled;
		}
		else {
			nightcore = !player.nightcore;
		}
		player.filters.timescale = nightcore ? { speed: 1.125, pitch: 1.125, rate: 1 } : undefined;
		await player.setFilters();
		player.nightcore = nightcore;
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('filterUpdate', { bassboost: player.bassboost, nightcore: player.nightcore });
		await interaction.replyHandler.locale(player.nightcore ? 'CMD.NIGHTCORE.RESPONSE.ENABLED' : 'CMD.NIGHTCORE.RESPONSE.DISABLED', { footer: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC.PLAYER.FILTER_NOTE') }, 'neutral');
	},
};

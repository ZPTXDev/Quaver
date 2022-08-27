import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getGuildLocale, getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('bassboost')
		.setDescription(getLocale(defaultLocale, 'CMD.BASSBOOST.DESCRIPTION'))
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription(getLocale(defaultLocale, 'CMD.BASSBOOST.OPTION.ENABLED'))),
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
		const boost = enabled !== null ? enabled : !player.bassboost;
		let eqValues = new Array(15).fill(0);
		if (boost) eqValues = [0.2, 0.15, 0.1, 0.05, 0.0, ...new Array(10).fill(-0.05)];
		await player.setEqualizer(eqValues);
		player.bassboost = boost;
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('filterUpdate', { bassboost: player.bassboost, nightcore: player.nightcore });
		return interaction.replyHandler.locale(player.bassboost ? 'CMD.BASSBOOST.RESPONSE.ENABLED' : 'CMD.BASSBOOST.RESPONSE.DISABLED', { footer: await getGuildLocale(interaction.guildId, 'MUSIC.PLAYER.FILTER_NOTE') });
	},
};

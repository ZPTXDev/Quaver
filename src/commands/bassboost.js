import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

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
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const enabled = interaction.options.getBoolean('enabled');
		let boost;
		if (enabled !== null) {
			boost = enabled;
		}
		else {
			boost = !player.bassboost;
		}
		let eqValues = new Array(15).fill(0);
		if (boost) {
			eqValues = [0.2, 0.15, 0.1, 0.05, 0.0, ...new Array(10).fill(-0.05)];
		}
		await player.setEqualizer(eqValues);
		player.bassboost = boost;
		await interaction.replyHandler.locale(player.bassboost ? 'CMD.BASSBOOST.RESPONSE.ENABLED' : 'CMD.BASSBOOST.RESPONSE.DISABLED', { footer: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC.PLAYER.FILTER_NOTE') });
	},
};

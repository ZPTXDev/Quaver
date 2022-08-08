import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale, managers } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('volume')
		.setDescription(getLocale(defaultLocale, 'CMD.VOLUME.DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('new_volume')
				.setDescription(getLocale(defaultLocale, 'CMD.VOLUME.OPTION.NEW_VOLUME'))
				.setMinValue(0)
				.setMaxValue(1000)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const volume = interaction.options.getInteger('new_volume');
		if (volume > 200 && !managers.includes(interaction.user.id)) {
			await interaction.replyHandler.locale('CMD.VOLUME.RESPONSE.OUT_OF_RANGE', {}, 'error');
			return;
		}
		await player.setVolume(volume);
		await interaction.replyHandler.locale('CMD.VOLUME.RESPONSE.SUCCESS', { footer: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC.PLAYER.FILTER_NOTE') }, 'neutral', volume);
	},
};

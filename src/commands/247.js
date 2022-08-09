import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('247')
		.setDescription(getLocale(defaultLocale, 'CMD.247.DESCRIPTION'))
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription(getLocale(defaultLocale, 'CMD.247.OPTION.ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (!features.stay.enabled) {
			await interaction.replyHandler.locale('FEATURE.DISABLED.DEFAULT', {}, 'error');
			return;
		}
		if (features.stay.whitelist && !await data.guild.get(interaction.guildId, 'features.stay.whitelisted')) {
			await interaction.replyHandler.locale('CMD.247.RESPONSE.FEATURE_NOT_WHITELISTED', {}, 'error');
			return;
		}
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player?.queue?.channel?.id) {
			await interaction.replyHandler.locale('CMD.247.RESPONSE.QUEUE_CHANNEL_MISSING', {}, 'error');
			return;
		}
		const enabled = interaction.options.getBoolean('enabled');
		let always;
		if (enabled !== null) {
			always = enabled;
		}
		else {
			always = !await data.guild.get(interaction.guildId, 'settings.stay.enabled');
		}
		await data.guild.set(interaction.guildId, 'settings.stay.enabled', always);
		if (always) {
			await data.guild.set(interaction.guildId, 'settings.stay.channel', player.channelId);
			await data.guild.set(interaction.guildId, 'settings.stay.text', player.queue.channel.id);
		}
		if (player.timeout) {
			clearTimeout(player.timeout);
			delete player.timeout;
		}
		// pause timeout is theoretically impossible because the user would need to be in the same vc as Quaver
		// and pause timeout is only set when everyone leaves
		await interaction.replyHandler.locale(always ? 'CMD.247.RESPONSE.ENABLED' : 'CMD.247.RESPONSE.DISABLED', { footer: always ? getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD.247.MISC.NOTE') : null });
	},
};

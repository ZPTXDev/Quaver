import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { defaultLocale, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getGuildLocaleString, getLocaleString } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('247')
		.setDescription(getLocaleString(defaultLocale, 'CMD.247.DESCRIPTION'))
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription(getLocaleString(defaultLocale, 'CMD.247.OPTION.ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const { io } = await import('#src/main.js');
		if (!features.stay.enabled) return interaction.replyHandler.locale('FEATURE.DISABLED.DEFAULT', { type: 'error' });
		if (features.stay.whitelist && !await data.guild.get(interaction.guildId, 'features.stay.whitelisted')) return interaction.replyHandler.locale('CMD.247.RESPONSE.FEATURE_NOT_WHITELISTED', { type: 'error' });
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player?.queue?.channel?.id) return interaction.replyHandler.locale('CMD.247.RESPONSE.QUEUE_CHANNEL_MISSING', { type: 'error' });
		const enabled = interaction.options.getBoolean('enabled');
		const always = enabled !== null ? enabled : !await data.guild.get(interaction.guildId, 'settings.stay.enabled');
		await data.guild.set(interaction.guildId, 'settings.stay.enabled', always);
		if (always) {
			await data.guild.set(interaction.guildId, 'settings.stay.channel', player.channelId);
			await data.guild.set(interaction.guildId, 'settings.stay.text', player.queue.channel.id);
		}
		if (player.timeout) {
			clearTimeout(player.timeout);
			delete player.timeout;
			if (features.web.enabled) io.to(`guild:${player.guildId}`).emit('timeoutUpdate', !!player.timeout);
		}
		// pause timeout is theoretically impossible because the user would need to be in the same vc as Quaver
		// and pause timeout is only set when everyone leaves
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, always ? 'CMD.247.RESPONSE.ENABLED' : 'CMD.247.RESPONSE.DISABLED'))
				.setFooter({ text: always ? await getGuildLocaleString(interaction.guildId, 'CMD.247.MISC.NOTE') : null }),
		);
		if (!always && !player.playing) player.queue.emit('finish');
	},
};

import { SlashCommandBuilder, ChannelType, PermissionsBitField } from 'discord.js';
import { defaultLocaleCode, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocaleString } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('bind')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.BIND.DESCRIPTION'))
		.addChannelOption(option =>
			option
				.setName('new_channel')
				.setDescription(getLocaleString(defaultLocaleCode, 'CMD.BIND.OPTION.NEW_CHANNEL'))
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		const channel = interaction.options.getChannel('new_channel');
		if (!channel.permissionsFor(interaction.client.user.id).has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) return interaction.replyHandler.locale('CMD.BIND.RESPONSE.PERMISSIONS_INSUFFICIENT', { args: [channel.id], type: 'error' });
		player.queue.channel = channel;
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('textChannelUpdate', channel.name);
		if (await data.guild.get(interaction.guildId, 'settings.stay.enabled')) await data.guild.set(interaction.guildId, 'settings.stay.text', channel.id);
		return interaction.replyHandler.locale('CMD.BIND.RESPONSE.SUCCESS', { args: [channel.id], type: 'success' });
	},
};

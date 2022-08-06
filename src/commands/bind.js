const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');
const { data } = require('#lib/util/common.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bind')
		.setDescription(getLocale(defaultLocale, 'CMD_BIND_DESCRIPTION'))
		.addChannelOption(option =>
			option
				.setName('new_channel')
				.setDescription(getLocale(defaultLocale, 'CMD_BIND_OPTION_CHANNEL'))
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const channel = interaction.options.getChannel('new_channel');
		if (!channel.permissionsFor(interaction.client.user.id).has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) {
			await interaction.replyHandler.locale('CMD_BIND_NO_PERMISSIONS', {}, 'error', channel.id);
			return;
		}
		player.queue.channel = channel;
		if (await data.guild.get(interaction.guildId, 'settings.stay.enabled')) {
			await data.guild.set(interaction.guildId, 'settings.stay.text', channel.id);
		}
		await interaction.replyHandler.locale('CMD_BIND_SUCCESS', {}, 'success', channel.id);
	},
};

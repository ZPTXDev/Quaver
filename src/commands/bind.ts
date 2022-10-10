import { data } from '#src/lib/util/common.js';
import type { QuaverChannels, QuaverInteraction, QuaverPlayer } from '#src/lib/util/common.types.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction, SlashCommandChannelOption } from 'discord.js';
import { ChannelType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('bind')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.BIND.DESCRIPTION'))
		.addChannelOption((option): SlashCommandChannelOption =>
			option
				.setName('new_channel')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.BIND.OPTION.NEW_CHANNEL'))
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: QuaverInteraction<ChatInputCommandInteraction>): Promise<void> {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId) as QuaverPlayer;
		const channel = interaction.options.getChannel('new_channel') as QuaverChannels;
		if (!channel.permissionsFor(interaction.client.user.id).has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) {
			await interaction.replyHandler.locale('CMD.BIND.RESPONSE.PERMISSIONS_INSUFFICIENT', { vars: [channel.id], type: 'error' });
			return;
		}
		player.queue.channel = channel;
		if (settings.features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('textChannelUpdate', channel.name);
		if (await data.guild.get(interaction.guildId, 'settings.stay.enabled')) await data.guild.set(interaction.guildId, 'settings.stay.text', channel.id);
		await interaction.replyHandler.locale('CMD.BIND.RESPONSE.SUCCESS', { vars: [channel.id], type: 'success' });
	},
};

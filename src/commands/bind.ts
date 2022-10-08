import { SlashCommandBuilder, ChannelType, PermissionsBitField, SlashCommandChannelOption, ChatInputCommandInteraction, Client, VoiceChannel, TextChannel } from 'discord.js';
import { defaultLocale, features } from '#src/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getLocaleString } from '#src/lib/util/util.js';
import { data } from '#src/lib/util/common.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node, Player } from 'lavaclient';
import { Queue } from '@lavaclient/queue';

export default {
	data: new SlashCommandBuilder()
		.setName('bind')
		.setDescription(getLocaleString(defaultLocale, 'CMD.BIND.DESCRIPTION'))
		.addChannelOption((option): SlashCommandChannelOption =>
			option
				.setName('new_channel')
				.setDescription(getLocaleString(defaultLocale, 'CMD.BIND.OPTION.NEW_CHANNEL'))
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { io } = await import('#src/main.js');
		const player = <Player<Node> & { queue: Queue & { channel: TextChannel | VoiceChannel } }> interaction.client.music.players.get(interaction.guildId);
		const channel = <TextChannel | VoiceChannel> interaction.options.getChannel('new_channel');
		if (!channel.permissionsFor(interaction.client.user.id).has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) {
			await interaction.replyHandler.locale('CMD.BIND.RESPONSE.PERMISSIONS_INSUFFICIENT', { args: [channel.id], type: 'error' });
			return;
		}
		player.queue.channel = channel;
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('textChannelUpdate', channel.name);
		if (await data.guild.get(interaction.guildId, 'settings.stay.enabled')) await data.guild.set(interaction.guildId, 'settings.stay.text', channel.id);
		await interaction.replyHandler.locale('CMD.BIND.RESPONSE.SUCCESS', { args: [channel.id], type: 'success' });
	},
};

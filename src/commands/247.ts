import { ChatInputCommandInteraction, Client, EmbedBuilder, SlashCommandBooleanOption, SlashCommandBuilder, TextChannel, VoiceChannel } from 'discord.js';
import { defaultLocaleCode, features } from '#src/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import { data } from '#src/lib/util/common.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node, Player } from 'lavaclient';
import { Queue } from '@lavaclient/queue';

export default {
	data: new SlashCommandBuilder()
		.setName('247')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.247.DESCRIPTION'))
		.addBooleanOption((option): SlashCommandBooleanOption =>
			option
				.setName('enabled')
				.setDescription(getLocaleString(defaultLocaleCode, 'CMD.247.OPTION.ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { io } = await import('#src/main.js');
		if (!features.stay.enabled) {
			await interaction.replyHandler.locale('FEATURE.DISABLED.DEFAULT', { type: 'error' });
			return;
		}
		if (features.stay.whitelist && !await data.guild.get(interaction.guildId, 'features.stay.whitelisted')) {
			await interaction.replyHandler.locale('CMD.247.RESPONSE.FEATURE_NOT_WHITELISTED', { type: 'error' });
			return;
		}
		const player = <Player<Node> & { queue: Queue & { channel: TextChannel | VoiceChannel }, timeout: ReturnType<typeof setTimeout> }> interaction.client.music.players.get(interaction.guildId);
		if (!player?.queue?.channel?.id) {
			await interaction.replyHandler.locale('CMD.247.RESPONSE.QUEUE_CHANNEL_MISSING', { type: 'error' });
			return;
		}
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

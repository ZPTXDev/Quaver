import { ChatInputCommandInteraction, Client, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { LoopType } from '@lavaclient/queue';
import { defaultLocale, features } from '#src/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('loop')
		.setDescription(getLocaleString(defaultLocale, 'CMD.LOOP.DESCRIPTION'))
		.addStringOption((option): SlashCommandStringOption =>
			option
				.setName('type')
				.setDescription(getLocaleString(defaultLocale, 'CMD.LOOP.OPTION.TYPE.DESCRIPTION'))
				.setRequired(true)
				.addChoices(
					{ name: getLocaleString(defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.DISABLED'), value: 'disabled' },
					{ name: getLocaleString(defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.TRACK'), value: 'track' },
					{ name: getLocaleString(defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.QUEUE'), value: 'queue' },
				)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		const type = interaction.options.getString('type');
		let loop, typeLocale;
		switch (type) {
			case 'disabled':
				loop = LoopType.None;
				typeLocale = await getGuildLocaleString(interaction.guildId, 'CMD.LOOP.OPTION.TYPE.OPTION.DISABLED');
				break;
			case 'track':
				loop = LoopType.Song;
				typeLocale = await getGuildLocaleString(interaction.guildId, 'CMD.LOOP.OPTION.TYPE.OPTION.TRACK');
				break;
			case 'queue':
				loop = LoopType.Queue;
				typeLocale = await getGuildLocaleString(interaction.guildId, 'CMD.LOOP.OPTION.TYPE.OPTION.QUEUE');
				break;
		}
		typeLocale = typeLocale.toLowerCase();
		player.queue.setLoop(loop);
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('loopUpdate', loop);
		await interaction.replyHandler.locale('CMD.LOOP.RESPONSE.SUCCESS', { args: [typeLocale] });
	},
};

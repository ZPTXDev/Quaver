import type ReplyHandler from '#src/lib/ReplyHandler.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import { LoopType } from '@lavaclient/queue';
import type { ChatInputCommandInteraction, Client, SlashCommandStringOption } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { Node } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('loop')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.LOOP.DESCRIPTION'))
		.addStringOption((option): SlashCommandStringOption =>
			option
				.setName('type')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.LOOP.OPTION.TYPE.DESCRIPTION'))
				.setRequired(true)
				.addChoices(
					{ name: getLocaleString(settings.defaultLocaleCode, 'CMD.LOOP.OPTION.TYPE.OPTION.DISABLED'), value: 'disabled' },
					{ name: getLocaleString(settings.defaultLocaleCode, 'CMD.LOOP.OPTION.TYPE.OPTION.TRACK'), value: 'track' },
					{ name: getLocaleString(settings.defaultLocaleCode, 'CMD.LOOP.OPTION.TYPE.OPTION.QUEUE'), value: 'queue' },
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
		if (settings.features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('loopUpdate', loop);
		await interaction.replyHandler.locale('CMD.LOOP.RESPONSE.SUCCESS', { vars: [typeLocale] });
	},
};

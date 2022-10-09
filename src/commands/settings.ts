import { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, SelectMenuBuilder, EmbedBuilder, ChatInputCommandInteraction, Message, SelectMenuComponentOptionData, MessageActionRowComponentBuilder } from 'discord.js';
import { settings } from '#src/lib/util/settings.js';
import { checks, settingsOptions } from '#src/lib/util/constants.js';
import { getLocaleString, buildMessageOptions, getGuildLocaleString, settingsPage } from '#src/lib/util/util.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';

export default {
	data: new SlashCommandBuilder()
		.setName('settings')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.SETTINGS.DESCRIPTION'))
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [PermissionsBitField.Flags.ManageGuild],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler }): Promise<void> {
		const option = <'language' | 'format'> settingsOptions[0];
		const guildLocaleCode = <string> await data.guild.get(interaction.guild.id, 'settings.locale') ?? settings.defaultLocaleCode;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocaleCode, option);
		const description = `${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`)}** ─ ${getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`)}\n> ${getLocaleString(guildLocaleCode, 'MISC.CURRENT')}: \`${current}\``;
		const msg = await interaction.replyHandler.reply(
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder<SelectMenuBuilder>()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('settings')
								.addOptions(
									settingsOptions.map((opt): SelectMenuComponentOptionData => ({ label: getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`), description: getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`), value: opt, default: opt === option })),
								),
						),
					actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
				],
				fetchReply: true,
			},
		);
		if (!(msg instanceof Message)) return;
		confirmationTimeout[msg.id] = setTimeout(async (message): Promise<void> => {
			try {
				await message.edit(
					buildMessageOptions(
						new EmbedBuilder()
							.setDescription(await getGuildLocaleString(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
						{ components: [] },
					),
				);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			}
			delete confirmationTimeout[message.id];
		}, 30 * 1000, msg);
	},
};

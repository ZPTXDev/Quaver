import { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, SelectMenuBuilder, EmbedBuilder, ChatInputCommandInteraction, Message, SelectMenuComponentOptionData, MessageActionRowComponentBuilder } from 'discord.js';
import { defaultLocale } from '#src/settings.js';
import { checks, settingsOptions } from '#src/lib/util/constants.js';
import { getLocaleString, messageDataBuilder, getGuildLocaleString, settingsPage } from '#src/lib/util/util.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';

export default {
	data: new SlashCommandBuilder()
		.setName('settings')
		.setDescription(getLocaleString(defaultLocale, 'CMD.SETTINGS.DESCRIPTION'))
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [PermissionsBitField.Flags.ManageGuild],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler }): Promise<void> {
		const option = <'language' | 'format'> settingsOptions[0];
		const guildLocale = <string> await data.guild.get(interaction.guild.id, 'settings.locale') ?? defaultLocale;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocale, option);
		const description = `${getLocaleString(guildLocale, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`)}** ─ ${getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`)}\n> ${getLocaleString(guildLocale, 'MISC.CURRENT')}: \`${current}\``;
		const msg = await interaction.replyHandler.reply(
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder<SelectMenuBuilder>()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('settings')
								.addOptions(
									settingsOptions.map((opt): SelectMenuComponentOptionData => ({ label: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`), description: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`), value: opt, default: opt === option })),
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
					messageDataBuilder(
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

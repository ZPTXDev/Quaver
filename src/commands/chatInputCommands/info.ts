import {
    ActionRowBuilder,
    type ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    OAuth2Scopes,
    PermissionsBitField,
    SectionBuilder,
    SeparatorBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from 'discord.js';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { settings } from '#src/lib/util/settings';
import { getLocaleString } from '#src/lib/util/util';
import { version } from '#src/lib/util/version';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('info')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.INFO.DESCRIPTION',
                ),
            ),
    )
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const buttons = {
            invite: guild.builders
                .buttonLocale('CMD.INFO.MISC.INVITE')
                .setStyle(ButtonStyle.Link)
                .setURL(
                    interaction.client.generateInvite({
                        permissions: [PermissionsBitField.Flags.Administrator],
                        scopes: [
                            OAuth2Scopes.Bot,
                            OAuth2Scopes.ApplicationsCommands,
                        ],
                    }),
                )
                .setEmoji('🔗'),
            supportServer: guild.builders
                .buttonLocale('CMD.INFO.MISC.SUPPORT_SERVER')
                .setStyle(ButtonStyle.Link)
                .setURL(settings.supportServer ?? 'https://example.com')
                .setEmoji('💬'),
            sourceCode: guild.builders
                .buttonLocale('CMD.INFO.MISC.SOURCE_CODE')
                .setStyle(ButtonStyle.Link)
                .setURL('https://go.zptx.dev/Quaver')
                .setEmoji('📖'),
            sponsorUs: guild.builders
                .buttonLocale('CMD.INFO.MISC.SPONSOR_US')
                .setStyle(ButtonStyle.Link)
                .setURL('https://github.com/sponsors/ZPTXDev')
                .setEmoji('💖'),
            translateForUs: guild.builders
                .buttonLocale('CMD.INFO.MISC.TRANSLATE_FOR_US')
                .setStyle(ButtonStyle.Link)
                .setURL('https://translate.zptx.dev/')
                .setEmoji('🌐'),
        };
        await interaction.replyHandler.reply(
            new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('## Quaver'),
                            guild.builders.textDisplayLocale(
                                'CMD.INFO.RESPONSE.SUCCESS',
                                version.version,
                            ),
                        )
                        .setThumbnailAccessory(
                            new ThumbnailBuilder().setURL(
                                interaction.client.user.displayAvatarURL({
                                    extension: 'png',
                                }),
                            ),
                        ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().setComponents(
                        buttons.invite,
                        ...(settings.supportServer
                            ? [buttons.supportServer]
                            : []),
                        buttons.sourceCode,
                        ...(!settings.disableAd ? [buttons.sponsorUs] : []),
                        buttons.translateForUs,
                    ),
                ),
            { ephemeral: true },
        );
    });

import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import { version } from '#src/lib/util/version.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
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
import { data } from '#src/lib/util/common.js';

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.INFO.DESCRIPTION'),
        ),
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        const buttons = {
            invite: new ButtonBuilder()
                .setLabel(
                    getLocaleString(guildLocaleCode, 'CMD.INFO.MISC.INVITE'),
                )
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
            supportServer: new ButtonBuilder()
                .setLabel(
                    getLocaleString(
                        guildLocaleCode,
                        'CMD.INFO.MISC.SUPPORT_SERVER',
                    ),
                )
                .setStyle(ButtonStyle.Link)
                .setURL(settings.supportServer ?? 'https://example.com')
                .setEmoji('💬'),
            sourceCode: new ButtonBuilder()
                .setLabel(
                    getLocaleString(
                        guildLocaleCode,
                        'CMD.INFO.MISC.SOURCE_CODE',
                    ),
                )
                .setStyle(ButtonStyle.Link)
                .setURL('https://go.zptx.dev/Quaver')
                .setEmoji('📖'),
            sponsorUs: new ButtonBuilder()
                .setLabel(
                    getLocaleString(
                        guildLocaleCode,
                        'CMD.INFO.MISC.SPONSOR_US',
                    ),
                )
                .setStyle(ButtonStyle.Link)
                .setURL('https://github.com/sponsors/ZPTXDev')
                .setEmoji('💖'),
            translateForUs: new ButtonBuilder()
                .setLabel(
                    getLocaleString(
                        guildLocaleCode,
                        'CMD.INFO.MISC.TRANSLATE_FOR_US',
                    ),
                )
                .setStyle(ButtonStyle.Link)
                .setURL('https://translate.zptx.dev/')
                .setEmoji('🌐'),
        };
        await interaction.replyHandler.reply(
            new ContainerBuilder({
                components: [
                    new SectionBuilder({
                        components: [
                            new TextDisplayBuilder()
                                .setContent('## Quaver')
                                .toJSON(),
                            new TextDisplayBuilder()
                                .setContent(
                                    getLocaleString(
                                        guildLocaleCode,
                                        'CMD.INFO.RESPONSE.SUCCESS',
                                        version,
                                    ),
                                )
                                .toJSON(),
                        ],
                        accessory: new ThumbnailBuilder()
                            .setURL(
                                interaction.client.user.displayAvatarURL({
                                    extension: 'png',
                                }),
                            )
                            .toJSON(),
                    }).toJSON(),
                    new SeparatorBuilder().toJSON(),
                    new ActionRowBuilder<ButtonBuilder>()
                        .setComponents(
                            buttons.invite,
                            ...(settings.supportServer
                                ? [buttons.supportServer]
                                : []),
                            buttons.sourceCode,
                            ...(!settings.disableAd ? [buttons.sponsorUs] : []),
                            buttons.translateForUs,
                        )
                        .toJSON(),
                ],
            }),
            { ephemeral: true },
        );
    },
};

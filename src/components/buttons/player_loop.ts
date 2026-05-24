import { buildNowPlayingMessage } from '#src/events/music/trackStart';
import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { PlayerResponse } from '#src/lib/music';
import { Check } from '#src/lib/util';
import { LoopType } from '@lavaclient/plugin-queue';

export default new ButtonHandler()
    .setChecks([Check.ActiveSession, Check.InVoice, Check.InSessionVoice])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        let loop, typeLocale;
        if (player.queue.loop.type === LoopType.None) {
            loop = LoopType.Song;
            typeLocale = guild.locale('CMD.LOOP.OPTION.TYPE.OPTION.TRACK');
        } else if (player.queue.loop.type === LoopType.Song) {
            loop = LoopType.Queue;
            typeLocale = guild.locale('CMD.LOOP.OPTION.TYPE.OPTION.QUEUE');
        } else {
            loop = LoopType.None;
            typeLocale = guild.locale('CMD.LOOP.OPTION.TYPE.OPTION.DISABLED');
        }
        typeLocale = typeLocale.toLowerCase();
        const response = await player.setLoopMode(loop);
        if (response === PlayerResponse.RestartInProgress) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                { type: MessageOptionsBuilderType.Error, ephemeral: true },
            );
            return;
        }
        if (response !== PlayerResponse.Success) return;
        if (player.queue.current) {
            const { container, actionRows } = await buildNowPlayingMessage(
                guild,
                player.queue.current,
            );
            await interaction.replyHandler.reply(
                container.addActionRowComponents(...actionRows),
                { force: ForceType.Update },
            );
        } else {
            await interaction.replyHandler.reply(
                guild.locale('CMD.LOOP.RESPONSE.SUCCESS', typeLocale),
                { type: MessageOptionsBuilderType.Success, ephemeral: true },
            );
        }
    });

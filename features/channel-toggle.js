import { ActionRowBuilder, AuditLogEvent } from 'discord.js';
import { BUTTON_CONFIG, CHANNEL_TOGGLE_ROLE_ID, COMMANDS, GENERAL_CHANNEL, getShowButton, MUTE_CATEGORY } from '../config.js';
import { getMemberName } from '../helper.js';

export const updatePermissionsOnChannelCreate = async (client, channel) => {
	const {
		parentId: channelCategoryId,
		id: channelId,
		name: channelName,
		guild,
	} = channel;
	if (!guild) return false; // This is a DM channel.
	if (MUTE_CATEGORY !== channelCategoryId) return;

	// A BIT HACKY BUT ONLY WAY - FOR NOW - TO FIND CHANNEL AUTHOR
	const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
	const channelAuthorEntry = auditLogs.entries.first();
	if (!channelAuthorEntry) return console.error('No entry found for channel author.');
	const author = await guild.members.fetch(channelAuthorEntry.executor.id);
	const hasUserOptIn = !!author.roles.cache.get(CHANNEL_TOGGLE_ROLE_ID);

	// ALLOW AUTHOR TO VIEW ITS CHANNEL
	if (hasUserOptIn) {
		channel.permissionOverwrites.create(channelAuthorEntry.executor.id, {
			ViewChannel: true,
		});
	}

	// HIDE NEW CHANNEL FOR USERS THAT CHOSED OPT-IN METHOD
	channel.permissionOverwrites.create(channel.guild.roles.cache.get(CHANNEL_TOGGLE_ROLE_ID), {
		ViewChannel: false,
	});

	// SEND BUTTONS TO OPT-IN/OPT-OUT
	const buttonsRow = new ActionRowBuilder().addComponents(getShowButton(channelId));
	client.channels.cache.get(GENERAL_CHANNEL).send({
		content: `${getMemberName(author)} vient de proposer la sortie: #${channelName}.`,
		components: [buttonsRow],
	});
};

export const handleChannelToggleClick = async (client, interaction) => {
	const { customId, user: { id: userId } } = interaction;

	if (!customId) return;

	const match = customId.match(/^(show|hide):(\d*)$/);

	// CLICK ON AN OTHER BUTTON
	if (!match || !match[1] || !match[2]) {
		return;
	}

	const actionString = match[1];
	const channelId = match[2];
	const buttonConfig = BUTTON_CONFIG[actionString];

	const hasUserOptIn = !!interaction.member.roles.cache.get(CHANNEL_TOGGLE_ROLE_ID);

	// NO NEED TO TOGGLE DISPLAY IF USER DOES NOT HAVE THE ROLE
	if (!hasUserOptIn) {
		await interaction.reply({ content: 'Pense à activer l\'option pour afficher/masquer les salons (/activer... ou /desactiver...)', ephemeral: true });
		return;
	}

	// SHOW/HIDE THE CHANNEL AND REPLY WITH OPPOSITE BUTTON
	if (buttonConfig.displayChannel) {
		client.channels.cache
			.get(channelId)
			.permissionOverwrites
			.create(userId, { ViewChannel:true });
	}
	else {
		client.channels.cache
			.get(channelId)
			.permissionOverwrites
			.delete(userId);
	}

	const buttonsRow = new ActionRowBuilder().addComponents(buttonConfig.getNextButton(channelId));

	await interaction.reply({ content: buttonConfig.message, components: [buttonsRow], ephemeral: true });
};

export const handleChannelToggleCommands = async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const { commandName } = interaction;

	if (![COMMANDS.activate.commandName, COMMANDS.deactivate.commandName].includes(commandName)) return;

	const role = interaction.guild.roles.cache.find(({ id }) => id === CHANNEL_TOGGLE_ROLE_ID);

	switch (commandName) {
	case COMMANDS.activate.commandName:
		interaction.member.roles.add(role);
		await interaction.reply({
			content: 'Suivi de sorties activé. Tu peux désormais recevoir des notifications pour les sorties que tu veux suivre uniquement.',
			ephemeral: true,
		});
		break;
	case COMMANDS.deactivate.commandName:
		interaction.member.roles.remove(role);
		await interaction.reply({
			content: 'Suivi de sorties désactivé. Tu verras toutes les sorties dans la section Sorties',
			ephemeral: true,
		});
		break;
	}
};

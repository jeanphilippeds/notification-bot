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
	if (!channelAuthorEntry) {
		console.error(`[CHAN] No entry found for channel #${channel.name} author.`);
		return;
	}
	const authorId = channelAuthorEntry.executor.id;
	const author = await guild.members.fetch(authorId);
	const hasUserOptIn = !!author.roles.cache.get(CHANNEL_TOGGLE_ROLE_ID);

	// ALLOW AUTHOR TO VIEW ITS CHANNEL
	if (hasUserOptIn) {
		channel.permissionOverwrites.create(authorId, {
			ViewChannel: true,
		});
		console.log(`[CHAN] User "${getMemberName(author)}" will follow its channel: #${channel.name}`);
	}

	// HIDE NEW CHANNEL FOR USERS THAT CHOSED OPT-IN METHOD
	channel.permissionOverwrites.create(channel.guild.roles.cache.get(CHANNEL_TOGGLE_ROLE_ID), {
		ViewChannel: false,
	});
	console.log(`[CHAN] Hiding channel #${channel.name} for all users that activated the feature.`);

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
		console.log(`[CHAN] User "${getMemberName(interaction.member)}" tried to use the feature before feature activation`);
		await interaction.reply({ content: 'Pense ?? activer l\'option pour afficher/masquer les salons (/activer... ou /desactiver...)', ephemeral: true });
		return;
	}

	// SHOW/HIDE THE CHANNEL AND REPLY WITH OPPOSITE BUTTON
	const toUpdateChannel = client.channels.cache.get(channelId);

	if (!toUpdateChannel) {
		console.log(`[CHAN] User "${getMemberName(interaction.member)}" tried to follow the deleted channel: #${toUpdateChannel.name}`);
		await interaction.reply({ content: 'Ce channel a ??t?? supprim?? :/', ephemeral: true });
		return;
	}

	if (buttonConfig.displayChannel) {
		toUpdateChannel.permissionOverwrites.create(userId, { ViewChannel:true });
		console.log(`[CHAN] User "${getMemberName(interaction.member)}" subscribed to channel: #${toUpdateChannel.name}`);
	}
	else {
		toUpdateChannel.permissionOverwrites.delete(userId);
		console.log(`[CHAN] User "${getMemberName(interaction.member)}" unsubscribed from channel: #${toUpdateChannel.name}`);
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
		console.log(`[CHAN] User "${getMemberName(interaction.member)}" activated the feature`);
		await interaction.reply({
			content: 'Suivi de sorties activ??. Tu peux d??sormais recevoir des notifications pour les sorties que tu veux suivre uniquement.',
			ephemeral: true,
		});
		break;
	case COMMANDS.deactivate.commandName:
		interaction.member.roles.remove(role);
		console.log(`[CHAN] User "${getMemberName(interaction.member)}" deactivated the feature`);
		await interaction.reply({
			content: 'Suivi de sorties d??sactiv??. Tu verras toutes les sorties dans la section Sorties',
			ephemeral: true,
		});
		break;
	}
};

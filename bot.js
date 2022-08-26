import { Client, GatewayIntentBits, AuditLogEvent, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import 'dotenv/config';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages
	]
});

const getEnvKeyOrThrow = key => {
	const value = process.env[key];

	if(!process.env[key]) {
		throw new Error(`${key} was not found (or is empty) in process.env`);
	} 
	return value;
}

const getShowButton = channelId => new ButtonBuilder()
		.setCustomId(`show:${channelId}`)
		.setLabel('Suivre la sortie')
		.setStyle(ButtonStyle.Primary);
const getHideButton = channelId => new ButtonBuilder()
		.setCustomId(`hide:${channelId}`)
		.setLabel('Masquer la sortie')
		.setStyle(ButtonStyle.Secondary);
const BUTTON_CONFIG = {
	show: {
		displayChannel: true,
		message: `Le salon est désormais visible dans Sorties`,
		getNextButton: getHideButton
	},
	hide: {
		displayChannel: false,
		message: `Le salon est masqué`,
		getNextButton: getShowButton
	}
}

const MUTE_CATEGORY = getEnvKeyOrThrow('MUTE_CATEGORY')
const GENERAL_CHANNEL = getEnvKeyOrThrow('GENERAL_CHANNEL')
const ROLE_TOGGLE_ID = getEnvKeyOrThrow('ROLE_TOGGLE_ID')

client.on('channelCreate', async channel => {
	const {
		parentId: channelCategoryId,
		id: channelId,
		name: channelName,
		guild
	} = channel
	if (!guild) return false; // This is a DM channel.
	if (MUTE_CATEGORY !== channelCategoryId) return;

	//HIDE NEW CHANNEL FOR USERS THAT CHOSED OPT-IN METHOD
	channel.permissionOverwrites.create(channel.guild.roles.cache.get(ROLE_TOGGLE_ID), {
		ViewChannel: false
	});

	//A BIT HACKY BUT ONLY WAY - FOR NOW - TO FIND CHANNEL AUTHOR
	const auditLogs = await guild.fetchAuditLogs({limit: 1, type: AuditLogEvent.ChannelCreate});
	const channelAuthorEntry = auditLogs.entries.first()
	if (!channelAuthorEntry) return console.error(`No entry found for channel author.`);
	const author = await guild.members.fetch(channelAuthorEntry.executor.id)
	const authorName = author.nickname ?? author.user.username ?? `Quelqu'un`;
	const hasUserOptIn = !!author.roles.cache.get(ROLE_TOGGLE_ID)

	//ALLOW AUTHOR TO VIEW ITS CHANNEL
	if (hasUserOptIn) {
		channel.permissionOverwrites.create(channelAuthorEntry.executor.id, {
			ViewChannel: true
		});
	}

	//SEND BUTTONS TO OPT-IN/OPT-OUT
	const buttonsRow = new ActionRowBuilder().addComponents(getShowButton(channelId));
	client.channels.cache.get(GENERAL_CHANNEL).send({
		content: `${authorName} vient de proposer la sortie: #${channelName}.`,
		components: [buttonsRow]
	});
});

client.once('ready', () => {
	console.log('Bot is ready!');

	client.channels.cache.get(GENERAL_CHANNEL)
		.createMessageComponentCollector()
		.on("collect", async interaction => {
			const {customId, user: {id: userId}} = interaction
			const match = customId.match(/^(show|hide)\:(\d*)$/)

			//CLICK ON AN OTHER BUTTON
			if (!match || !match[1] || !match[2]) {
				await interaction.deferUpdate();
				return;
			};

			const actionString = match[1];
			const channelId = match[2];
			const buttonConfig = BUTTON_CONFIG[actionString];

			const user = await interaction.guild.members.fetch(userId)
			const hasUserOptIn = !!user.roles.cache.get(ROLE_TOGGLE_ID)

			//NO NEED TO TOGGLE DISPLAY IF USER DOES NOT HAVE THE ROLE
			if (!hasUserOptIn) {
				await interaction.reply({ content: `Pense à activer l'option pour afficher/masquer les salons`, ephemeral: true });
				return;
			}

			//SHOW/HIDE THE CHANNEL AND REPLY WITH OPPOSITE BUTTON
			client.channels.cache
				.get(channelId)
				.permissionOverwrites
				.create(userId, {
					ViewChannel: buttonConfig.displayChannel
				});
			const buttonsRow = new ActionRowBuilder().addComponents(buttonConfig.getNextButton(channelId))

			await interaction.reply({ content: buttonConfig.message, components: [buttonsRow], ephemeral: true })
		});

});

client.login(getEnvKeyOrThrow('BOT_TOKEN'));
import { Client, GatewayIntentBits, AuditLogEvent, ActionRowBuilder } from 'discord.js';
import { getShowButton, BUTTON_CONFIG, MUTE_CATEGORY, GENERAL_CHANNEL, ROLE_TOGGLE_ID, BOT_TOKEN, COMMANDS} from './config.js'

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages
	]
});

client.on('channelCreate', async channel => {
	const {
		parentId: channelCategoryId,
		id: channelId,
		name: channelName,
		guild
	} = channel
	if (!guild) return false; // This is a DM channel.
	if (MUTE_CATEGORY !== channelCategoryId) return;

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

	//HIDE NEW CHANNEL FOR USERS THAT CHOSED OPT-IN METHOD
	channel.permissionOverwrites.create(channel.guild.roles.cache.get(ROLE_TOGGLE_ID), {
		ViewChannel: false
	});

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
				await interaction.reply({ content: `Pense à activer l'option pour afficher/masquer les salons (/activer... ou /desactiver...)`, ephemeral: true });
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

	client.on('interactionCreate', async interaction => {
		if (!interaction.isChatInputCommand()) return;
	
		const { commandName, user: {id: userId} } = interaction;
		const user = await interaction.guild.members.fetch(userId);
		const role = interaction.guild.roles.cache.find(({id}) => id === ROLE_TOGGLE_ID);

		switch (commandName) {
			case COMMANDS.activate.commandName:
				user.roles.add(role);
				await interaction.reply({
					content: 'Suivi de sorties activé. Tu peux désormais recevoir des notifications pour les sorties que tu veux suivre uniquement.',
					ephemeral: true
				});g
				break;
			case COMMANDS.deactivate.commandName:
				user.roles.remove(role);
				await interaction.reply({
					content: 'Suivi de sorties désactivé. Tu verras toutes les sorties dans la section Sorties',
					ephemeral: true
				});
				break;
			default:
		}
	});
});

client.login(BOT_TOKEN);
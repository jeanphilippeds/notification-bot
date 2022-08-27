import { Client, GatewayIntentBits } from 'discord.js';
import { BOT_TOKEN } from './config.js';
import { handleCarpoolCommand, handleCarpoolModalSubmit } from './features/carpool.js';
import { handleChannelToggleClick, handleChannelToggleCommands, updatePermissionsOnChannelCreate } from './features/channel-toggle.js';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
	],
});

const useChannelToggleFeature = true;
const useCarpoolFeature = true;

if (useChannelToggleFeature) {
	client.on('channelCreate', async channel => {
		await updatePermissionsOnChannelCreate(client, channel);
	});
	client.on('interactionCreate', async interaction => {
		await handleChannelToggleCommands(interaction);
		await handleChannelToggleClick(client, interaction);
	});
}

if (useCarpoolFeature) {
	client.on('interactionCreate', async interaction => {
		await handleCarpoolCommand(interaction);
		await handleCarpoolModalSubmit(interaction);
	});
}

client.once('ready', () => {
	console.log('Bot is ready!');
});

client.login(BOT_TOKEN);
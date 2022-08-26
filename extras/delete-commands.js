const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');

const rest = new REST({ version: '10' }).setToken(token);

// for guild-based commands
rest.delete(Routes.applicationGuildCommand(clientId, guildId, '1002570141793534023'))
	.then(() => console.log('Successfully deleted guild command'))
	.catch(console.error);

rest.delete(Routes.applicationGuildCommand(clientId, guildId, '1002570141793534024'))
	.then(() => console.log('Successfully deleted guild command'))
	.catch(console.error);

rest.delete(Routes.applicationGuildCommand(clientId, guildId, '1002570141793534025'))
	.then(() => console.log('Successfully deleted guild command'))
	.catch(console.error);

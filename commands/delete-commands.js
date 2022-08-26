import { Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import { APPLICATION_ID, GUILD_ID, BOT_TOKEN } from '../config.js';

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

// for guild-based commands
rest.delete(Routes.applicationGuildCommand(APPLICATION_ID, GUILD_ID, '1012768665143349389'))
	.then(() => console.log('Successfully deleted guild command'))
	.catch(console.error);
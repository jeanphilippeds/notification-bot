import { SlashCommandBuilder, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import { APPLICATION_ID, GUILD_ID, BOT_TOKEN, COMMANDS } from '../config.js';

const commands = [
	new SlashCommandBuilder().setName(COMMANDS.activate.commandName).setDescription(COMMANDS.activate.helpText),
	new SlashCommandBuilder().setName(COMMANDS.deactivate.commandName).setDescription(COMMANDS.deactivate.helpText)
]
	.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);

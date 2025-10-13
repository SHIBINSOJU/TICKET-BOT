// index.js

const fs = require('node:fs');
const path = require('node:path');
// Import REST and Routes for command deployment
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');

// Load environment variables from .env file
require('dotenv').config();
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// Basic validation to ensure environment variables are loaded
if (!token || !clientId || !guildId) {
    console.error('Error: Missing TOKEN, CLIENT_ID, or GUILD_ID in .env file.');
    process.exit(1); // Exit the script with an error code
}

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- STEP 1: LOAD COMMAND FILES ---
client.commands = new Collection();
const commands = []; // Array to hold command data for deployment
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        // Add the command to the client's collection for execution
        client.commands.set(command.data.name, command);
        // Add the command's JSON data to the array for deployment
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// --- STEP 2: AUTO-DEPLOY COMMANDS ON STARTUP ---
// This section automatically registers/updates slash commands with Discord
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();


// --- STEP 3: SETUP EVENT LISTENERS & RUN THE BOT ---

// Listener for Slash Command Interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

// Listener for Button Interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'confirm_action') {
        await interaction.reply({ content: 'You confirmed the action!', ephemeral: true });
    } else {
        // Generic response for any other button clicks
        await interaction.reply({ content: `You clicked the button with ID: ${interaction.customId}`, ephemeral: true });
    }
});

// Listener for when the client is ready
client.once(Events.ClientReady, c => {
    console.log(`✅ Ready! Logged in as ${c.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);


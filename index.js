const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const connectDB = require("./utils/mongoConnect");

dotenv.config();

// Create client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
});

client.commands = new Collection();

// Handlers
require("./handlers/commandHandler")(client);
require("./handlers/eventHandler")(client);

// Connect to MongoDB
connectDB();

// Login
client.login(process.env.TOKEN);

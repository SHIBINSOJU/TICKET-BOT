const { Schema, model } = require('mongoose');

const guildConfigSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    panelChannelId: {
        type: String,
        required: true,
    },
    panelMessageId: {
        type: String,
        required: true,
    },
    logChannelId: {
        type: String,
        required: true,
    },
    supportRoleIds: {
        type: [String], // An array of Role IDs
        default: [],
    },
    ticketCategoryId: {
        type: String,
        required: true,
    },
    ticketCount: {
        type: Number,
        default: 0,
    },
});

module.exports = model('GuildConfig', guildConfigSchema);

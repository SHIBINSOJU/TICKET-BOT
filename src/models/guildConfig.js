const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    // We store an array of categories, each with a label and role ID.
    buttonCategories: [{
        label: { type: String, required: true },
        roleId: { type: String, required: true },
    }],
    messageId: { // To keep track of the message with the buttons
        type: String,
        required: false,
    },
    channelId: { // To know which channel the message is in
        type: String,
        required: false,
    }
});

module.exports = mongoose.model('GuildConfig', guildConfigSchema);

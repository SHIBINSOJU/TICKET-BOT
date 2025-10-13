const mongoose = require('mongoose');

const ticketConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    // An array to hold all the button configurations
    buttons: [{
        customId: { type: String, required: true },
        label: { type: String, required: true },
        emoji: { type: String, required: false },
    }],
});

module.exports = mongoose.model('TicketConfig', ticketConfigSchema);

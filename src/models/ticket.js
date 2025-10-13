const { Schema, model } = require('mongoose');

const ticketSchema = new Schema({
    guildId: {
        type: String,
        required: true,
    },
    channelId: {
        type: String,
        required: true,
        unique: true,
    },
    creatorId: {
        type: String,
        required: true,
    },
    claimedById: {
        type: String,
        default: null, // No one has claimed it initially
    },
    status: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    reason: {
        type: String,
        required: true,
    },
});

module.exports = model('Ticket', ticketSchema);


const { InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const GuildConfig = require('../../models/guildConfig');
const Ticket = require('../../models/ticket');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // --- 1. HANDLE SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
            return;
        }

        // --- 2. HANDLE BUTTON INTERACTIONS ---
        if (interaction.isButton()) {
            const { customId } = interaction;

            // Ticket Creation Buttons
            if (customId.startsWith('ticket_create_')) {
                return await handleTicketCreation(interaction, client);
            }

            // Ticket Management Buttons
            switch (customId) {
                case 'close_ticket':
                    await handleCloseTicket(interaction, client);
                    break;
                case 'confirm_close':
                    await handleConfirmClose(interaction, client);
                    break;
                case 'cancel_close':
                    // Just delete the confirmation message
                    await interaction.message.delete();
                    break;
                case 'claim_ticket':
                    await handleClaimTicket(interaction, client);
                    break;
            }
        }

        // --- 3. HANDLE MODAL SUBMISSIONS ---
        if (interaction.type === InteractionType.ModalSubmit) {
            if (interaction.customId.startsWith('ticket_modal_')) {
                await handleModalSubmit(interaction, client);
            }
        }
    },
};

// --- TICKET CREATION FUNCTIONS (from previous step, no changes) ---
async function handleTicketCreation(interaction, client) {
    try {
        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!guildConfig) return await interaction.reply({ content: 'The ticket system has not been configured.', ephemeral: true });
        const existingTicket = await Ticket.findOne({ guildId: interaction.guild.id, creatorId: interaction.user.id, status: 'open' });
        if (existingTicket) return await interaction.reply({ content: `You already have an open ticket in <#${existingTicket.channelId}>.`, ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`ticket_modal_${interaction.customId.split('_')[2]}`).setTitle('Create a New Ticket');
        const reasonInput = new TextInputBuilder().setCustomId('ticket_reason').setLabel("What is the reason for this ticket?").setStyle(TextInputStyle.Paragraph).setPlaceholder('Please provide details.').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    } catch (error) { console.error('Error in handleTicketCreation:', error); }
}

async function handleModalSubmit(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const reason = interaction.fields.getTextInputValue('ticket_reason');
    const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
    try {
        guildConfig.ticketCount += 1;
        await guildConfig.save();
        const ticketNumber = guildConfig.ticketCount;
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}-${ticketNumber}`, type: ChannelType.GuildText, parent: guildConfig.ticketCategoryId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
                ...guildConfig.supportRoleIds.map(roleId => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] })),
            ],
        });
        await Ticket.create({ guildId: interaction.guild.id, channelId: channel.id, creatorId: interaction.user.id, reason: reason });
        const ticketEmbed = new EmbedBuilder().setTitle(`Ticket #${ticketNumber}`).setDescription(`**Creator:** <@${interaction.user.id}>\n**Reason:**\n\`\`\`${reason}\`\`\``).setColor('Green').setTimestamp();
        const ticketButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('✅'),
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🧍'),
            new ButtonBuilder().setCustomId('warn_user').setLabel('Warn User').setStyle(ButtonStyle.Secondary).setEmoji('⚠️')
        );
        await channel.send({ content: `<@&${guildConfig.supportRoleIds.join('>, <@&')}>, a new ticket has been created by <@${interaction.user.id}>.`, embeds: [ticketEmbed], components: [ticketButtons] });
        await interaction.editReply({ content: `Your ticket has been created in <#${channel.id}>.`, ephemeral: true });
    } catch (error) { console.error('Error handling modal submission:', error); }
}

// --- NEW TICKET MANAGEMENT FUNCTIONS ---

async function handleCloseTicket(interaction, client) {
    const confirmationEmbed = new EmbedBuilder()
        .setTitle('Confirmation')
        .setDescription('Are you sure you want to close this ticket?')
        .setColor('Yellow');

    const confirmationButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({ embeds: [confirmationEmbed], components: [confirmationButtons], ephemeral: false });
}

async function handleConfirmClose(interaction, client) {
    await interaction.deferUpdate(); // Acknowledge the button click

    try {
        const ticket = await Ticket.findOne({ guildId: interaction.guild.id, channelId: interaction.channel.id });
        if (!ticket || ticket.status === 'closed') return;

        // Update ticket status in DB
        ticket.status = 'closed';
        await ticket.save();

        // Lock the channel for the ticket creator
        await interaction.channel.permissionOverwrites.edit(ticket.creatorId, {
            SendMessages: false,
            ViewChannel: true // Can still view history
        });

        const closeEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setDescription(`This ticket has been closed by <@${interaction.user.id}>.`)
            .setColor('Red')
            .setTimestamp();
        
        // Optional: Add a "Delete Ticket" button for permanent deletion
        const deleteButton = new ActionRowBuilder().addComponents(
             new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await interaction.channel.send({ embeds: [closeEmbed], components: [deleteButton] });
        await interaction.channel.setTopic(`Closed by ${interaction.user.tag}`);

        // Delete the confirmation message
        await interaction.message.delete();
    } catch (error) {
        console.error("Error during ticket close confirmation:", error);
    }
}

async function handleClaimTicket(interaction, client) {
    await interaction.deferUpdate();

    try {
        const ticket = await Ticket.findOne({ guildId: interaction.guild.id, channelId: interaction.channel.id });
        if (!ticket || ticket.claimedById) return; // Already claimed or not a ticket

        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        const memberRoles = interaction.member.roles.cache;

        // Check if the user has a support role
        const isSupportStaff = memberRoles.some(role => guildConfig.supportRoleIds.includes(role.id));
        if (!isSupportStaff) {
             return interaction.followUp({ content: 'You do not have permission to claim tickets.', ephemeral: true });
        }

        // Update DB
        ticket.claimedById = interaction.user.id;
        await ticket.save();

        // Update the original embed
        const originalMessage = interaction.message;
        const originalEmbed = originalMessage.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .addFields({ name: 'Claimed By', value: `<@${interaction.user.id}>` });

        // Disable the claim button
        const originalComponents = originalMessage.components[0];
        originalComponents.components.forEach(button => {
            if (button.customId === 'claim_ticket') {
                button.setDisabled(true);
            }
        });

        await originalMessage.edit({ embeds: [updatedEmbed], components: [originalComponents] });

        await interaction.followUp({ content: `You have successfully claimed this ticket!`, ephemeral: true });
    } catch (error) {
        console.error("Error claiming ticket:", error);
    }
}

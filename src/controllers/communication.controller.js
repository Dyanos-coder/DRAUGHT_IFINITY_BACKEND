const Communication = require('../models/communication.model');

// Get all communications
exports.getAllCommunications = async (req, res) => {
  try {
    const status = req.query.status;
    let query = {};
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    const communications = await Communication.find(query)
      .sort({ createdAt: -1 });
    
    // Transform the data to match frontend expectations
    const transformedCommunications = communications.map(comm => ({
      id: comm._id,
      title: comm.title,
      content: comm.content,
      recipients: comm.recipients,
      status: comm.status,
      scheduled: comm.status === 'scheduled',
      scheduledDate: comm.scheduledDate ? comm.scheduledDate.toISOString().split('T')[0] : undefined,
      scheduledTime: comm.scheduledDate ? comm.scheduledDate.toISOString().split('T')[1].substring(0, 5) : undefined,
      createdAt: comm.createdAt.toISOString(),
      updatedAt: comm.updatedAt ? comm.updatedAt.toISOString() : undefined
    }));
    
    res.status(200).json({
      communications: transformedCommunications,
      total: transformedCommunications.length
    });
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des communications', error: error.message });
  }
};

// Get communication by ID
exports.getCommunicationById = async (req, res) => {
  try {
    const communication = await Communication.findById(req.params.id);
    if (!communication) {
      return res.status(404).json({ message: 'Communication non trouvée' });
    }
    
    // Transform to match frontend expectations
    const transformedCommunication = {
      id: communication._id,
      title: communication.title,
      content: communication.content,
      recipients: communication.recipients,
      status: communication.status,
      scheduled: communication.status === 'scheduled',
      scheduledDate: communication.scheduledDate ? communication.scheduledDate.toISOString().split('T')[0] : undefined,
      scheduledTime: communication.scheduledDate ? communication.scheduledDate.toISOString().split('T')[1].substring(0, 5) : undefined,
      createdAt: communication.createdAt.toISOString(),
      updatedAt: communication.updatedAt ? communication.updatedAt.toISOString() : undefined
    };
    
    res.status(200).json({ communication: transformedCommunication });
  } catch (error) {
    console.error('Error fetching communication:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la communication', error: error.message });
  }
};

// Create new communication
exports.createCommunication = async (req, res) => {
  try {
    const { title, content, recipients = 'all', status, scheduled, scheduledDate, scheduledTime } = req.body;
    
    // Handle scheduled communications
    let finalStatus = status || 'draft';
    let finalScheduledDate = null;
    
    if (scheduled && scheduledDate) {
      finalStatus = 'scheduled';
      
      // Create a Date object with the provided date
      finalScheduledDate = new Date(scheduledDate);
      
      // If time is provided, set hours and minutes
      if (scheduledTime) {
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        finalScheduledDate.setHours(hours, minutes, 0, 0);
      } else {
        // Default to noon if no time provided
        finalScheduledDate.setHours(12, 0, 0, 0);
      }
      
      // Make sure the scheduled date is in the future
      const now = new Date();
      if (finalScheduledDate <= now) {
        return res.status(400).json({ 
          message: 'La date programmée doit être dans le futur',
          error: 'INVALID_DATE'
        });
      }
    }
    
    const newCommunication = new Communication({
      title,
      content,
      recipients,
      status: finalStatus,
      scheduledDate: finalScheduledDate,
    });
    
    const savedCommunication = await newCommunication.save();
    
    // Transform for frontend
    const transformedCommunication = {
      id: savedCommunication._id,
      title: savedCommunication.title,
      content: savedCommunication.content,
      recipients: savedCommunication.recipients,
      status: savedCommunication.status,
      scheduled: savedCommunication.status === 'scheduled',
      scheduledDate: savedCommunication.scheduledDate ? savedCommunication.scheduledDate.toISOString().split('T')[0] : undefined,
      scheduledTime: savedCommunication.scheduledDate ? savedCommunication.scheduledDate.toISOString().split('T')[1].substring(0, 5) : undefined,
      createdAt: savedCommunication.createdAt.toISOString(),
      updatedAt: savedCommunication.updatedAt ? savedCommunication.updatedAt.toISOString() : undefined
    };
    
    res.status(201).json({ communication: transformedCommunication });
  } catch (error) {
    console.error('Error creating communication:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la communication', error: error.message });
  }
};

// Update communication
exports.updateCommunication = async (req, res) => {
  try {
    const { title, content, recipients, status, scheduled, scheduledDate, scheduledTime } = req.body;
    
    // Prepare update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (recipients !== undefined) updateData.recipients = recipients;
    
    // Handle status and scheduled date
    if (status !== undefined) updateData.status = status;
    
    if (scheduled) {
      updateData.status = 'scheduled';
      
      // If date is provided, update scheduled date
      if (scheduledDate) {
        const finalScheduledDate = new Date(scheduledDate);
        
        // If time is provided, set hours and minutes
        if (scheduledTime) {
          const [hours, minutes] = scheduledTime.split(':').map(Number);
          finalScheduledDate.setHours(hours, minutes, 0, 0);
        } else {
          // Default to noon if no time provided
          finalScheduledDate.setHours(12, 0, 0, 0);
        }
        
        // Make sure the scheduled date is in the future
        const now = new Date();
        if (finalScheduledDate <= now) {
          return res.status(400).json({ 
            message: 'La date programmée doit être dans le futur',
            error: 'INVALID_DATE'
          });
        }
        
        updateData.scheduledDate = finalScheduledDate;
      }
    } else if (scheduled === false) {
      // If explicitly set to not scheduled
      updateData.status = status || 'draft';
      updateData.scheduledDate = null;
    }
    
    updateData.updatedAt = new Date();
    
    const updatedCommunication = await Communication.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCommunication) {
      return res.status(404).json({ message: 'Communication non trouvée' });
    }
    
    // Transform for frontend
    const transformedCommunication = {
      id: updatedCommunication._id,
      title: updatedCommunication.title,
      content: updatedCommunication.content,
      recipients: updatedCommunication.recipients,
      status: updatedCommunication.status,
      scheduled: updatedCommunication.status === 'scheduled',
      scheduledDate: updatedCommunication.scheduledDate ? updatedCommunication.scheduledDate.toISOString().split('T')[0] : undefined,
      scheduledTime: updatedCommunication.scheduledDate ? updatedCommunication.scheduledDate.toISOString().split('T')[1].substring(0, 5) : undefined,
      createdAt: updatedCommunication.createdAt.toISOString(),
      updatedAt: updatedCommunication.updatedAt ? updatedCommunication.updatedAt.toISOString() : undefined
    };
    
    res.status(200).json({ communication: transformedCommunication });
  } catch (error) {
    console.error('Error updating communication:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la communication', error: error.message });
  }
};

// Delete communication
exports.deleteCommunication = async (req, res) => {
  try {
    const deletedCommunication = await Communication.findByIdAndDelete(req.params.id);
    
    if (!deletedCommunication) {
      return res.status(404).json({ message: 'Communication non trouvée' });
    }
    
    res.status(200).json({ message: 'Communication supprimée avec succès', id: req.params.id });
  } catch (error) {
    console.error('Error deleting communication:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la communication', error: error.message });
  }
};

// Update status of scheduled communications
exports.updateScheduledCommunications = async () => {
  try {
    const now = new Date();
    console.log(`Vérification des communications planifiées à ${now.toISOString()}`);
    
    const scheduledCommunications = await Communication.find({ 
      status: 'scheduled', 
      scheduledDate: { $lte: now } 
    });
    
    console.log(`Trouvé ${scheduledCommunications.length} communication(s) à marquer comme envoyée(s)`);
    
    for (const communication of scheduledCommunications) {
      // Pour éviter le déclenchement du middleware pre-save
      await Communication.updateOne(
        { _id: communication._id },
        { $set: { status: 'sent', updatedAt: now } }
      );
      
      console.log(`Communication ID ${communication._id} marquée comme envoyée (planifiée pour: ${communication.scheduledDate.toISOString()})`);
    }
  } catch (error) {
    console.error('Error updating scheduled communications:', error);
  }
};

// Add endpoint for immediately sending a communication
exports.sendCommunicationNow = async (req, res) => {
  try {
    const communication = await Communication.findById(req.params.id);
    
    if (!communication) {
      return res.status(404).json({ message: 'Communication non trouvée' });
    }
    
    communication.status = 'sent';
    communication.scheduledDate = null;
    communication.updatedAt = new Date();
    
    const savedCommunication = await communication.save();
    
    // Transform for frontend
    const transformedCommunication = {
      id: savedCommunication._id,
      title: savedCommunication.title,
      content: savedCommunication.content,
      recipients: savedCommunication.recipients,
      status: savedCommunication.status,
      scheduled: false,
      scheduledDate: null,
      scheduledTime: null,
      createdAt: savedCommunication.createdAt.toISOString(),
      updatedAt: savedCommunication.updatedAt ? savedCommunication.updatedAt.toISOString() : undefined
    };
    
    res.status(200).json({ communication: transformedCommunication });
  } catch (error) {
    console.error('Error sending communication:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de la communication', error: error.message });
  }
}; 
const mongoose = require('mongoose');
const { Schema } = mongoose;

const communicationSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  recipients: { type: String, required: true }, // 'all', 'participants', 'admins', etc.
  status: { 
    type: String, 
    required: true, 
    enum: ['draft', 'scheduled', 'sent', 'cancelled'],
    default: 'draft'
  },
  scheduledDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware to update the status based on scheduledDate
communicationSchema.pre('save', function(next) {
  const now = new Date();
  
  // Ne mettre à jour le statut que si:
  // 1. Ce n'est pas une nouvelle création
  // 2. Le statut est "scheduled"
  // 3. Une date est définie
  // 4. La date et l'heure programmées sont dans le passé
  if (this.status === 'scheduled' && this.scheduledDate) {
    // Log pour debug
    console.log(`Vérification date programmée: ${this.scheduledDate.toISOString()}`);
    console.log(`Date actuelle: ${now.toISOString()}`);
    console.log(`Est dans le passé: ${this.scheduledDate <= now}`);
    console.log(`Est nouveau document: ${this.isNew}`);
    
    // Ne marquer comme envoyé que si ce n'est pas un nouveau document ET que la date est passée
    if (!this.isNew && this.scheduledDate <= now) {
      console.log(`Marquage auto de la communication ${this._id} comme envoyée`);
      this.status = 'sent';
    }
  }
  
  this.updatedAt = now;
  next();
});

module.exports = mongoose.model('Communication', communicationSchema); 
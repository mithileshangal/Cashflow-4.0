const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  dealType: { type: String, enum: ['small', 'big'], required: true },
  name: { type: String, required: true },
  cost: { type: Number, required: true },
  passiveIncome: { type: Number, required: true },
  owners: [{
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  }],
});

const Deal = mongoose.model('Deal', dealSchema);
module.exports = Deal;
const mongoose = require('mongoose');

const tableLogSchema = new mongoose.Schema({
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const TableLog = mongoose.model('TableLog', tableLogSchema);
module.exports = TableLog;
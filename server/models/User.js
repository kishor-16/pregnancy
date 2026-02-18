const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
        name: String,
        lmp: Date,
        edd: Date
    },
    hydration: [{
        amount: Number,
        date: String,
        timestamp: { type: Date, default: Date.now }
    }],
    medicines: [{
        name: String,
        dosage: String,
        time: String,
        startDate: Date,
        endDate: Date,
        takenToday: { type: Boolean, default: false }
    }],
    moods: [{
        mood: String,
        notes: String,
        date: String,
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);

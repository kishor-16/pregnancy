const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('./middleware/auth');
const User = require('./models/User');
const Post = require('./models/Post');

// --- Auth Routes ---

// Register
router.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ error: 'User already exists' });

        user = new User({ email, password, profile: { name } });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, email: user.email, name: user.profile.name } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Login
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid Credentials' });

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, email: user.email, name: user.profile.name, lmp: user.profile.lmp } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Current User
router.get('/auth/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Health Data Routes ---

// LMP
router.post('/lmp', auth, async (req, res) => {
    const { lmp } = req.body;
    try {
        const user = await User.findById(req.user.id);
        user.profile.lmp = lmp;
        await user.save();
        res.json({ lmp });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/lmp', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ lmp: user.profile.lmp });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Hydration
router.post('/hydration', auth, async (req, res) => {
    const { amount } = req.body;
    try {
        const user = await User.findById(req.user.id);
        const entry = {
            amount: parseInt(amount),
            date: new Date().toISOString().split('T')[0]
        };
        user.hydration.push(entry);
        await user.save();
        res.status(201).json(entry);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/hydration/today', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const today = new Date().toISOString().split('T')[0];
        const todayEntries = user.hydration.filter(h => h.date === today);
        const total = todayEntries.reduce((sum, h) => sum + h.amount, 0);
        res.json({ total, entries: todayEntries });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Medicine
router.post('/medicine', auth, async (req, res) => {
    const { name, dosage, time, endDate } = req.body;
    try {
        const user = await User.findById(req.user.id);
        const medicine = { name, dosage, time, endDate, startDate: new Date() };
        user.medicines.push(medicine);
        await user.save();
        res.status(201).json(medicine);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/medicine', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json(user.medicines);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.put('/medicine/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const med = user.medicines.id(req.params.id);
        if (!med) return res.status(404).json({ error: 'Medicine not found' });

        Object.assign(med, req.body);
        await user.save();
        res.json(med);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Mood
router.post('/mood', auth, async (req, res) => {
    const { mood, notes } = req.body;
    try {
        const user = await User.findById(req.user.id);
        const entry = {
            mood,
            notes,
            date: new Date().toISOString().split('T')[0]
        };
        user.moods.push(entry);
        await user.save();
        res.status(201).json(entry);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/mood', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json(user.moods);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// --- Community Routes ---

router.post('/posts', auth, async (req, res) => {
    const { content } = req.body;
    try {
        const user = await User.findById(req.user.id);
        const newPost = new Post({
            content,
            author: user.id,
            authorName: user.profile.name || user.email.split('@')[0]
        });
        const post = await newPost.save();
        res.status(201).json(post);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/posts', auth, async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// --- Static/Helper Info ---

const weeklyInfoData = {
    1: { growth: "Conception occurs; cells begin to divide.", symptoms: "Fatigue, missed period." },
    4: { growth: "The embryo is about the size of a poppy seed.", symptoms: "Bloating, mood swings." },
    8: { growth: "Baby is now the size of a raspberry. Fingers/toes forming.", symptoms: "Morning sickness, fatigue." },
    12: { growth: "Baby is the size of a lime. Reflexes are beginning.", symptoms: "Increased appetite, frequency of urination." },
    16: { growth: "Baby is the size of an avocado. Hair is starting to grow.", symptoms: "Backaches, nosebleeds." },
    20: { growth: "Baby is the size of a banana. You can feel kicks!", symptoms: "Heartburn, leg cramps." },
    24: { growth: "Baby is the size of an ear of corn. Lungs developing.", symptoms: "Swollen ankles, stretch marks." },
    28: { growth: "Baby is the size of an eggplant. Dreaming begins.", symptoms: "Difficulty sleeping, Braxton Hicks." },
    32: { growth: "Baby is the size of a squash. Skin is getting smooth.", symptoms: "Shortness of breath, leaky breasts." },
    36: { growth: "Baby is the size of a papaya. Moving into position.", symptoms: "Pelvic pressure, frequent urination." },
    40: { growth: "Baby is full term. Ready to meet the world!", symptoms: "Strong contractions, nesting instinct." }
};

router.get('/weekly-info/:week', (req, res) => {
    const week = parseInt(req.params.week);
    const milestones = Object.keys(weeklyInfoData).map(Number).sort((a, b) => b - a);
    const closest = milestones.find(m => m <= week) || 1;
    res.json(weeklyInfoData[closest]);
});

module.exports = router;

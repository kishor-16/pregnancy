const express = require('express');
const router = express.Router();
const { readData, writeData } = require('./dataStore');

// Hydration Routes
router.post('/hydration', (req, res) => {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    const data = readData();
    const entry = {
        id: Date.now(),
        amount: parseInt(amount),
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
    };
    data.hydration.push(entry);
    writeData(data);
    res.status(201).json(entry);
});

router.get('/hydration/today', (req, res) => {
    const data = readData();
    const today = new Date().toISOString().split('T')[0];
    const todayHydration = data.hydration.filter(h => h.date === today);
    const total = todayHydration.reduce((sum, h) => sum + h.amount, 0);
    res.json({ total, entries: todayHydration });
});

router.get('/hydration/history', (req, res) => {
    const data = readData();
    res.json(data.hydration);
});

// Medicine Routes
router.post('/medicine', (req, res) => {
    const { name, dosage, time, startDate, endDate } = req.body;
    if (!name || !dosage || !time) return res.status(400).json({ error: 'Missing medicine details' });

    const data = readData();
    const medicine = {
        id: Date.now(),
        name,
        dosage,
        time,
        startDate,
        endDate,
        takenToday: false
    };
    data.medicines.push(medicine);
    writeData(data);
    res.status(201).json(medicine);
});

router.get('/medicine', (req, res) => {
    const data = readData();
    res.json(data.medicines);
});

router.put('/medicine/:id', (req, res) => {
    const data = readData();
    const index = data.medicines.findIndex(m => m.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Medicine not found' });

    data.medicines[index] = { ...data.medicines[index], ...req.body };
    writeData(data);
    res.json(data.medicines[index]);
});

router.delete('/medicine/:id', (req, res) => {
    const data = readData();
    data.medicines = data.medicines.filter(m => m.id != req.params.id);
    writeData(data);
    res.status(204).send();
});

// Mood Routes
router.post('/mood', (req, res) => {
    const { mood, notes } = req.body;
    if (!mood) return res.status(400).json({ error: 'Mood is required' });

    const data = readData();
    const entry = {
        id: Date.now(),
        mood,
        notes,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
    };
    data.moods.push(entry);
    writeData(data);
    res.status(201).json(entry);
});

router.get('/mood', (req, res) => {
    const data = readData();
    res.json(data.moods);
});

// Community Routes
router.post('/posts', (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const data = readData();
    const post = {
        id: Date.now(),
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: []
    };
    data.posts.push(post);
    writeData(data);
    res.status(201).json(post);
});

router.get('/posts', (req, res) => {
    const data = readData();
    res.json(data.posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

router.put('/posts/:id', (req, res) => {
    const data = readData();
    const index = data.posts.findIndex(p => p.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Post not found' });

    data.posts[index] = { ...data.posts[index], ...req.body };
    writeData(data);
    res.json(data.posts[index]);
});

router.delete('/posts/:id', (req, res) => {
    const data = readData();
    data.posts = data.posts.filter(p => p.id != req.params.id);
    writeData(data);
    res.status(204).send();
});

// Diet Routes (Static)
const dietData = {
    trimester1: ["Folic acid rich foods", "Leafy greens", "Citrus fruits", "Whole grains"],
    trimester2: ["Calcium rich foods", "Dairy", "Lean protein", "Iron rich foods"],
    trimester3: ["DHA rich foods", "Nuts and seeds", "Berries", "Avocados"]
};

// Weekly Info (Growth & Symptoms)
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
    // Find the closest previous milestone or current
    const milestones = Object.keys(weeklyInfoData).map(Number).sort((a, b) => b - a);
    const closest = milestones.find(m => m <= week) || 1;
    res.json(weeklyInfoData[closest]);
});

router.get('/diet/:week', (req, res) => {
    const week = parseInt(req.params.week);
    let trimester = 'trimester1';
    if (week > 13 && week <= 26) trimester = 'trimester2';
    else if (week > 26) trimester = 'trimester3';
    res.json({ trimester, suggestions: dietData[trimester] });
});

// LMP Routes
router.post('/lmp', (req, res) => {
    const { lmp } = req.body;
    const data = readData();
    data.lmp = lmp;
    writeData(data);
    res.json({ lmp });
});

router.get('/lmp', (req, res) => {
    const data = readData();
    res.json({ lmp: data.lmp });
});

router.post('/reset', (req, res) => {
    const emptyData = {
        lmp: null,
        hydration: { total: 0, entries: [] },
        medicine: [],
        mood: [],
        posts: []
    };
    fs.writeFileSync(dataFilePath, JSON.stringify(emptyData, null, 2));
    res.json({ success: true });
});

// Alerts Routes (In-Memory for simplicity)
let alerts = [];

router.get('/alerts', (req, res) => {
    res.json(alerts);
});

router.post('/alerts', (req, res) => {
    const { title, message, type } = req.body;
    const newAlert = {
        id: Date.now(),
        title,
        message,
        type: type || 'info', // info, warning, success, danger
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    alerts.unshift(newAlert);
    if (alerts.length > 20) alerts.pop();
    res.status(201).json(newAlert);
});

module.exports = router;

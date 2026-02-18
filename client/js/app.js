// Utility: Format Date
function formatDate(date) {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Global API fetch wrapper with Auth
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token && !url.includes('/auth/')) {
        window.location.href = '/login.html';
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        return;
    }

    return response;
}

// Navigation Logic
function showSection(sectionId) {
    const sections = ['dashboard', 'hydration', 'medicine', 'mood', 'diet', 'community', 'alerts'];
    sections.forEach(s => {
        const div = document.getElementById(`${s}Section`);
        if (div) div.style.display = s === sectionId ? 'block' : 'none';
        const link = document.querySelector(`.nav-links a[onclick*="${s}"]`);
        if (link) link.classList.toggle('active', s === sectionId);
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// Global State
let selectedMood = '';

// 1. Dashboard & Week Calculation
async function initDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const res = await apiFetch('/api/auth/user');
    const user = await res.json();
    localStorage.setItem('user', JSON.stringify(user));

    if (!user.profile.lmp) {
        window.location.href = '/index.html';
        return;
    }

    const lmpDate = new Date(user.profile.lmp);
    const today = new Date();

    const diffTime = Math.abs(today - lmpDate);
    const currentWeek = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
    const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);

    document.getElementById('welcomeHeader').innerText = `Good morning, ${user.profile.name || 'Mama'}! ✨`;
    document.getElementById('currentWeekNum').innerText = `Week ${currentWeek}`;
    document.getElementById('eddText').innerText = `Expected Delivery: ${formatDate(eddDate)}`;

    loadHydrationSummary();
    loadMedicineSummary();
    loadLatestMood();
    loadDiet(currentWeek);
    loadWeeklyInfo(currentWeek);
}

// 1.1 Weekly Info Logic
async function loadWeeklyInfo(week) {
    const res = await apiFetch(`/api/weekly-info/${week}`);
    const data = await res.json();
    document.getElementById('babyGrowthText').innerText = data.growth;
    document.getElementById('weeklySymptomsText').innerText = data.symptoms;
}

// 2. Hydration Logic
async function loadHydrationSummary() {
    const res = await apiFetch('/api/hydration/today');
    const data = await res.json();
    const goal = 2500;
    const progress = Math.min((data.total / goal) * 100, 100);

    document.getElementById('hydrationProgress').style.width = `${progress}%`;
    document.getElementById('hydrationStats').innerText = `${data.total}ml / ${goal}ml`;

    if (document.getElementById('hydrationSection').style.display !== 'none') {
        document.getElementById('hydrationProgressLarge').style.width = `${progress}%`;
        document.getElementById('hydrationStatsLarge').innerText = `${data.total}ml / ${goal}ml`;
    }

    if (data.total >= goal && !localStorage.getItem('hydrationGoalMet_' + new Date().toDateString())) {
        triggerCelebration("Hydration Hero! 💧", "You've successfully met your daily water intake goal. Your baby says thank you!");
        localStorage.setItem('hydrationGoalMet_' + new Date().toDateString(), 'true');
        generateAlert("Goal Reached! 🌟", "You completed your hydration goal for today.", "success");
    }
}

async function addWater() {
    const amount = document.getElementById('waterInMls').value;
    if (!amount) return alert('Please enter amount');

    await apiFetch('/api/hydration', {
        method: 'POST',
        body: JSON.stringify({ amount })
    });

    document.getElementById('waterInMls').value = '';
    loadHydrationSummary();
}

async function addWaterPreset(amount) {
    await apiFetch('/api/hydration', {
        method: 'POST',
        body: JSON.stringify({ amount })
    });
    loadHydrationSummary();
}

// 3. Medicine Logic
async function loadMedicineSummary() {
    const res = await apiFetch('/api/medicine');
    const meds = await res.json();
    const miniList = document.getElementById('medicineMiniList');
    miniList.innerHTML = meds.slice(0, 3).map(m => `<li><i class="fas fa-check-circle" style="color: ${m.takenToday ? 'var(--secondary)' : '#ddd'}"></i> ${m.name} - ${m.time}</li>`).join('');

    const container = document.getElementById('medicineListContainer');
    container.innerHTML = meds.map(m => `
        <div class="card">
            <h4>${m.name}</h4>
            <p>${m.dosage} @ ${m.time}</p>
            <p style="font-size: 0.8rem; color: #888;">Ends: ${formatDate(m.endDate)}</p>
            <div style="margin-top: 10px;">
                <button onclick="toggleMedStatus('${m._id}')" class="btn" style="padding: 5px 10px; background: ${m.takenToday ? 'var(--secondary)' : '#eee'}">${m.takenToday ? 'Taken' : 'Mark Taken'}</button>
                <button onclick="deleteMed('${m._id}')" class="btn" style="padding: 5px 10px; background: #ffebee; color: #f44336;">Delete</button>
            </div>
        </div>
    `).join('');
}

async function addMedicine() {
    const name = document.getElementById('medName').value;
    const dosage = document.getElementById('medDosage').value;
    const time = document.getElementById('medTime').value;
    const endDate = document.getElementById('medEnd').value;

    if (!name || !dosage || !time) return alert('Please fill all required fields');

    await apiFetch('/api/medicine', {
        method: 'POST',
        body: JSON.stringify({ name, dosage, time, endDate })
    });

    loadMedicineSummary();
    clearMedForm();
}

function clearMedForm() {
    document.getElementById('medName').value = '';
    document.getElementById('medDosage').value = '';
    document.getElementById('medTime').value = '';
    document.getElementById('medEnd').value = '';
}

async function toggleMedStatus(id) {
    await apiFetch(`/api/medicine/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ takenToday: true }) // Simplified for demo
    });
    loadMedicineSummary();
}

// 4. Mood Logic
function selectMood(mood, btn) {
    selectedMood = mood;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function saveMood() {
    if (!selectedMood) return alert('Please select a mood');
    const notes = document.getElementById('moodNotes').value;

    await apiFetch('/api/mood', {
        method: 'POST',
        body: JSON.stringify({ mood: selectedMood, notes })
    });

    document.getElementById('moodNotes').value = '';
    loadLatestMood();
    loadMoodHistory();
}

async function loadLatestMood() {
    const res = await apiFetch('/api/mood');
    const moods = await res.json();
    const latest = moods[moods.length - 1];
    const display = document.getElementById('latestMoodDisplay');
    const sugg = document.getElementById('moodSuggestionText');

    if (!latest) {
        display.innerText = 'No entries yet';
        return;
    }

    const icons = { 'Happy': '😊', 'Sad': '😢', 'Irritated': '😠', 'Anxious': '😰', 'Tired': '😴' };
    display.innerText = `${icons[latest.mood] || ''} ${latest.mood}`;

    let tip = '';
    if (latest.mood === 'Anxious') tip = "Try a 5-minute breathing exercise. 🧘‍♀️";
    else if (latest.mood === 'Sad') tip = "A short walk might brighten your day. 🌸";
    else if (latest.mood === 'Irritated') tip = "Listen to some calming music. 🎵";
    else if (latest.mood === 'Tired') tip = "It's time for a cozy power nap. 😴";
    else tip = "Keep smiling! You're doing great. ✨";

    sugg.innerText = `Tip: ${tip}`;
}

async function loadMoodHistory() {
    const res = await apiFetch('/api/mood');
    const moods = await res.json();
    const history = document.getElementById('moodHistoryList');
    history.innerHTML = moods.reverse().map(m => `
        <div class="card" style="margin-bottom: 10px;">
            <strong>${m.mood}</strong> - ${m.date}
            <p style="font-size: 0.9rem;">${m.notes || 'No notes added.'}</p>
        </div>
    `).join('');
}

// 5. Community Logic
async function loadPosts() {
    const res = await apiFetch('/api/posts');
    const posts = await res.json();
    const container = document.getElementById('postsContainer');
    container.innerHTML = posts.map(p => `
        <div class="card post" style="margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <div style="width: 40px; height: 40px; background: var(--primary-pink); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; margin-right: 12px; font-weight: bold;">${p.authorName[0].toUpperCase()}</div>
                <div>
                    <h4 style="margin: 0;">${p.authorName}</h4>
                    <span style="font-size: 0.7rem; color: #888;">${new Date(p.createdAt).toLocaleString()}</span>
                </div>
            </div>
            <p class="post-content">${p.content}</p>
            <div class="post-actions">
                <span><i class="fas fa-heart"></i> ${p.likes}</span>
                <span><i class="fas fa-comment"></i> ${p.comments.length}</span>
            </div>
        </div>
    `).join('');
}

async function createPost() {
    const content = document.getElementById('postContent').value;
    if (!content) return alert('Cannot post empty content');

    await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content })
    });

    document.getElementById('postContent').value = '';
    loadPosts();
}

// 6. Diet Logic
async function loadDiet(week) {
    const res = await apiFetch(`/api/diet/${week}`);
    const data = await res.json();
    const container = document.getElementById('dietContainer');
    container.innerHTML = `
        <h3>Trimester ${data.trimester.slice(-1)} Recommendations</h3>
        <p>Based on your current week (${week}), here are some foods to focus on:</p>
        <ul style="margin-top: 1rem; list-style: inside;">
            ${data.suggestions.map(s => `<li>${s}</li>`).join('')}
        </ul>
    `;
}

// 7. Achievement & Alert System
function triggerCelebration(title, message) {
    document.getElementById('achievementTitle').innerText = title;
    document.getElementById('achievementMsg').innerText = message;
    const modal = document.getElementById('celebrationModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.querySelector('.modal-content').classList.add('show'), 10);
}

function closeCelebration() {
    const modal = document.getElementById('celebrationModal');
    modal.querySelector('.modal-content').classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

async function generateAlert(title, message, type = 'info') {
    // In-memory alerts for now or can be added to DB if needed
    console.log(`Alert: ${title} - ${message}`);
}

// Init everything
window.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    if ("Notification" in window) {
        Notification.requestPermission();
    }
});

// Watch for section changes to refresh data
const originalShowSection = showSection;
window.showSection = function (id) {
    originalShowSection(id);
    if (id === 'hydration') loadHydrationSummary();
    if (id === 'medicine') loadMedicineSummary();
    if (id === 'mood') { loadLatestMood(); loadMoodHistory(); }
    if (id === 'community') loadPosts();
};

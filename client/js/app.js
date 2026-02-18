// Utility: Format Date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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

// Global State
let selectedMood = '';

// 1. Dashboard & Week Calculation
async function initDashboard() {
    const lmp = localStorage.getItem('lmp');
    if (!lmp) {
        window.location.href = '/index.html';
        return;
    }

    const lmpDate = new Date(lmp);
    const today = new Date();

    // Calculate weeks: (Today - LMP) / (7 * 24 * 60 * 60 * 1000)
    const diffTime = Math.abs(today - lmpDate);
    const currentWeek = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));

    // Calculate EDD: LMP + 280 days
    const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);

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
    const res = await fetch(`/api/weekly-info/${week}`);
    const data = await res.json();
    document.getElementById('babyGrowthText').innerText = data.growth;
    document.getElementById('weeklySymptomsText').innerText = data.symptoms;
}

// 2. Hydration Logic
async function loadHydrationSummary() {
    const res = await fetch('/api/hydration/today');
    const data = await res.json();
    const goal = 2500;
    const progress = Math.min((data.total / goal) * 100, 100);

    document.getElementById('hydrationProgress').style.width = `${progress}%`;
    document.getElementById('hydrationStats').innerText = `${data.total}ml / ${goal}ml`;

    if (document.getElementById('hydrationSection').style.display !== 'none') {
        document.getElementById('hydrationProgressLarge').style.width = `${progress}%`;
        document.getElementById('hydrationStatsLarge').innerText = `${data.total}ml / ${goal}ml`;
    }

    // Achievement: Hydration Goal
    if (data.total >= goal && !localStorage.getItem('hydrationGoalMet_' + new Date().toDateString())) {
        triggerCelebration("Hydration Hero! 💧", "You've successfully met your daily water intake goal. Your baby says thank you!");
        localStorage.setItem('hydrationGoalMet_' + new Date().toDateString(), 'true');
        generateAlert("Goal Reached! 🌟", "You completed your hydration goal for today.", "success");
    }
}

async function addWater() {
    const amount = document.getElementById('waterInMls').value;
    if (!amount) return alert('Please enter amount');

    await fetch('/api/hydration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
    });

    document.getElementById('waterInMls').value = '';
    loadHydrationSummary();
}

async function addWaterPreset(amount) {
    await fetch('/api/hydration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
    });
    loadHydrationSummary();
}

// 3. Medicine Logic
async function loadMedicineSummary() {
    const res = await fetch('/api/medicine');
    const meds = await res.json();
    const miniList = document.getElementById('medicineMiniList');
    miniList.innerHTML = meds.slice(0, 3).map(m => `<li><i class="fas fa-check-circle" style="color: ${m.takenToday ? 'var(--secondary)' : '#ddd'}"></i> ${m.name} - ${m.time}</li>`).join('');

    const container = document.getElementById('medicineListContainer');
    container.innerHTML = meds.map(m => `
        <div class="card">
            <h4>${m.name}</h4>
            <p>${m.dosage} @ ${m.time}</p>
            <p style="font-size: 0.8rem; color: #888;">Ends: ${m.endDate}</p>
            <div style="margin-top: 10px;">
                <button onclick="toggleMedStatus(${m.id})" class="btn" style="padding: 5px 10px; background: ${m.takenToday ? 'var(--secondary)' : '#eee'}">${m.takenToday ? 'Taken' : 'Mark Taken'}</button>
                <button onclick="deleteMed(${m.id})" class="btn" style="padding: 5px 10px; background: #ffebee; color: #f44336;">Delete</button>
            </div>
        </div>
    `).join('');

    // Achievement: All Meds Taken
    const allTaken = meds.length > 0 && meds.every(m => m.takenToday);
    if (allTaken && !localStorage.getItem('medsGoalMet_' + new Date().toDateString())) {
        triggerCelebration("Medicine Master! 💊", "You've taken all your scheduled medicines for today. Great job keeping up!");
        localStorage.setItem('medsGoalMet_' + new Date().toDateString(), 'true');
        generateAlert("Meds Completed! ✅", "All scheduled medicines for today have been taken.", "success");
    }
}

async function addMedicine() {
    const name = document.getElementById('medName').value;
    const dosage = document.getElementById('medDosage').value;
    const time = document.getElementById('medTime').value;
    const endDate = document.getElementById('medEnd').value;

    if (!name || !dosage || !time) return alert('Please fill all required fields');

    await fetch('/api/medicine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

async function deleteMed(id) {
    await fetch(`/api/medicine/${id}`, { method: 'DELETE' });
    loadMedicineSummary();
}

async function toggleMedStatus(id) {
    const res = await fetch('/api/medicine');
    const meds = await res.json();
    const med = meds.find(m => m.id == id);
    await fetch(`/api/medicine/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ takenToday: !med.takenToday })
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

    await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: selectedMood, notes })
    });

    document.getElementById('moodNotes').value = '';
    loadLatestMood();
    loadMoodHistory();
}

async function loadLatestMood() {
    const res = await fetch('/api/mood');
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
    const res = await fetch('/api/mood');
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
    const res = await fetch('/api/posts');
    const posts = await res.json();
    const container = document.getElementById('postsContainer');
    container.innerHTML = posts.map(p => `
        <div class="card post" style="margin-bottom: 1.5rem;">
            <p class="post-content">${p.content}</p>
            <div class="post-actions">
                <span onclick="likePost(${p.id})" style="cursor: pointer;"><i class="fas fa-heart"></i> ${p.likes}</span>
                <span><i class="fas fa-comment"></i> ${p.comments.length}</span>
                <span onclick="deletePost(${p.id})" style="cursor: pointer; color: #f44336; margin-left: auto;"><i class="fas fa-trash"></i></span>
            </div>
            <div class="comments" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 5px;">
                ${p.comments.map(c => `<p style="font-size: 0.8rem;">• ${c}</p>`).join('')}
                <div style="display: flex; margin-top: 5px;">
                    <input type="text" id="commInput-${p.id}" placeholder="Add a comment..." style="font-size: 0.8rem; padding: 5px;">
                    <button onclick="addComment(${p.id})" style="background: none; border: none; color: var(--primary-dark); cursor: pointer;">Add</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function createPost() {
    const content = document.getElementById('postContent').value;
    if (!content) return alert('Cannot post empty content');

    await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });

    document.getElementById('postContent').value = '';
    loadPosts();
}

async function likePost(id) {
    const res = await fetch('/api/posts');
    const posts = await res.json();
    const post = posts.find(p => p.id == id);
    await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ likes: post.likes + 1 })
    });
    loadPosts();
}

async function addComment(id) {
    const input = document.getElementById(`commInput-${id}`);
    const comment = input.value;
    if (!comment) return;

    const res = await fetch('/api/posts');
    const posts = await res.json();
    const post = posts.find(p => p.id == id);
    post.comments.push(comment);

    await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: post.comments })
    });
    loadPosts();
}

async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    loadPosts();
}

// 6. Diet Logic
async function loadDiet(week) {
    const res = await fetch(`/api/diet/${week}`);
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

// Medicine Notifications
function checkReminders() {
    fetch('/api/medicine').then(res => res.json()).then(meds => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        meds.forEach(med => {
            if (med.time === currentTime && !med.notified) {
                // Browser alert
                alert(`⏰ Time to take your medicine: ${med.name} (${med.dosage})`);

                // Mark as notified in local session
                med.notified = true;

                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Medicine Reminder", { body: `Time for ${med.name} (${med.dosage})` });
                }

                generateAlert("Medicine Reminder", `It's time for ${med.name} (${med.dosage})`, "warning");
            }

            // Missed check (1 hour late)
            const medTime = new Date();
            const [h, m] = med.time.split(':');
            medTime.setHours(parseInt(h), parseInt(m), 0);
            if (now.getTime() > (medTime.getTime() + 3600000) && !med.takenToday && !med.missedAlertShown) {
                generateAlert("Missed Medicine?", `You haven't marked ${med.name} as taken yet.`, "danger");
                med.missedAlertShown = true;
            }
        });
    });
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
    await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, type })
    });
    updateAlertBadge();
}

async function loadAlerts() {
    const res = await fetch('/api/alerts');
    const alerts = await res.json();
    const container = document.getElementById('alertsContainer');
    const icons = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', success: 'fa-check-circle', danger: 'fa-times-circle' };

    if (alerts.length === 0) {
        container.innerHTML = '<p style="color: #888;">No new alerts. You\'re doing great, Mama! ✨</p>';
        return;
    }

    container.innerHTML = alerts.map(a => `
        <div class="alert-item alert-${a.type}">
            <div class="alert-icon"><i class="fas ${icons[a.type] || 'fa-bell'}"></i></div>
            <div>
                <strong>${a.title}</strong><br>
                <span style="font-size: 0.9rem;">${a.message}</span>
            </div>
            <div class="alert-time">${a.time}</div>
        </div>
    `).join('');

    // Clear badge when viewing
    document.getElementById('alertBadge').style.display = 'none';
}

async function updateAlertBadge() {
    const res = await fetch('/api/alerts');
    const alerts = await res.json();
    const badge = document.getElementById('alertBadge');
    if (alerts && alerts.length > 0) {
        badge.innerText = alerts.length;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function periodicAlertChecks() {
    // Water reminder every 2 hours if no intake
    fetch('/api/hydration/today').then(res => res.json()).then(data => {
        const lastEntry = data.entries.length > 0 ? new Date(data.entries[data.entries.length - 1].timestamp) : null;
        const now = new Date();
        if (!lastEntry || (now - lastEntry) > 7200000) { // 2 hours
            generateAlert("Hydration Reminder 💧", "It's been a while since your last glass of water. Keep hydrating, Mama!", "info");
        }
    });
}

// Init everything
window.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    // Request notification permission
    if ("Notification" in window) {
        Notification.requestPermission();
    }

    // Polling for reminders
    setInterval(checkReminders, 60000); // Check every minute
    setInterval(periodicAlertChecks, 3600000); // Check every hour

    // Initial badge update
    updateAlertBadge();

    // Refresh data periodically
    setInterval(loadHydrationSummary, 300000); // Every 5 mins
});

// Refresh to Start Over Logic
if (performance.getEntriesByType('navigation')[0].type === 'reload') {
    localStorage.removeItem('lmp');
    fetch('/api/reset', { method: 'POST' }).then(() => {
        window.location.href = '/index.html';
    });
}

// Watch for section changes to refresh data
const originalShowSection = showSection;
window.showSection = function (id) {
    originalShowSection(id);
    if (id === 'hydration') loadHydrationSummary();
    if (id === 'medicine') loadMedicineSummary();
    if (id === 'mood') { loadLatestMood(); loadMoodHistory(); }
    if (id === 'community') loadPosts();
    if (id === 'alerts') loadAlerts();
};

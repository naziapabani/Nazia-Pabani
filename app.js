// UC Food Tracker - Main Application

class UCFoodTracker {
    constructor() {
        this.foodLog = this.loadFromStorage() || [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateDisplay();
    }

    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('food-search');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        searchInput.addEventListener('focus', (e) => {
            if (e.target.value) this.handleSearch(e.target.value);
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('search-results').classList.remove('active');
            }
        });

        // Custom food form toggle
        document.getElementById('toggle-custom-food').addEventListener('click', () => {
            document.getElementById('custom-food-form').classList.toggle('hidden');
        });

        // Add custom food
        document.getElementById('add-custom-food').addEventListener('click', () => this.addCustomFood());

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    handleSearch(query) {
        const resultsContainer = document.getElementById('search-results');

        if (!query.trim()) {
            resultsContainer.classList.remove('active');
            return;
        }

        const results = FOOD_DATABASE.filter(food =>
            food.name.toLowerCase().includes(query.toLowerCase()) ||
            food.category.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10);

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result-item">No foods found. Try adding a custom food!</div>';
        } else {
            resultsContainer.innerHTML = results.map(food => `
                <div class="search-result-item" data-food='${JSON.stringify(food)}'>
                    <div>
                        <div class="food-name">${food.name}</div>
                        <div class="food-info">${food.calories} cal | ${food.protein}g protein</div>
                    </div>
                    <div class="food-badges">
                        ${this.getBadgesHTML(food)}
                    </div>
                </div>
            `).join('');

            // Add click handlers to results
            resultsContainer.querySelectorAll('.search-result-item[data-food]').forEach(item => {
                item.addEventListener('click', () => {
                    const food = JSON.parse(item.dataset.food);
                    this.addFood(food);
                    document.getElementById('food-search').value = '';
                    resultsContainer.classList.remove('active');
                });
            });
        }

        resultsContainer.classList.add('active');
    }

    getBadgesHTML(food) {
        let badges = [];

        // Anti-inflammatory badge
        if (food.antiInflammatory === 'yes') {
            badges.push('<span class="badge anti-inflammatory">Anti-Inflam</span>');
        } else if (food.antiInflammatory === 'no') {
            badges.push('<span class="badge inflammatory">Inflammatory</span>');
        }

        // UC safety badge
        if (food.ucSafe === 'safe') {
            badges.push('<span class="badge uc-safe">UC Safe</span>');
        } else if (food.ucSafe === 'caution') {
            badges.push('<span class="badge uc-caution">Caution</span>');
        } else if (food.ucSafe === 'avoid') {
            badges.push('<span class="badge uc-avoid">Avoid</span>');
        }

        // Ayurveda badge (show only if pitta-pacifying)
        if (food.ayurveda === 'pitta-pacifying') {
            badges.push('<span class="badge pitta">Pitta ↓</span>');
        }

        return badges.join('');
    }

    addFood(food) {
        const entry = {
            ...food,
            id: Date.now(),
            timestamp: new Date().toISOString()
        };
        this.foodLog.push(entry);
        this.saveToStorage();
        this.updateDisplay();
    }

    addCustomFood() {
        const name = document.getElementById('custom-name').value.trim();
        const calories = parseInt(document.getElementById('custom-calories').value) || 0;
        const protein = parseFloat(document.getElementById('custom-protein').value) || 0;
        const antiInflammatory = document.getElementById('custom-anti-inflammatory').value;
        const ucSafe = document.getElementById('custom-uc-safe').value;
        const ayurveda = document.getElementById('custom-ayurveda').value;

        if (!name) {
            alert('Please enter a food name');
            return;
        }

        const food = {
            name,
            calories,
            protein,
            antiInflammatory,
            ucSafe,
            ayurveda,
            category: 'custom'
        };

        this.addFood(food);

        // Clear form
        document.getElementById('custom-name').value = '';
        document.getElementById('custom-calories').value = '';
        document.getElementById('custom-protein').value = '';
        document.getElementById('custom-food-form').classList.add('hidden');
    }

    removeFood(id) {
        this.foodLog = this.foodLog.filter(food => food.id !== id);
        this.saveToStorage();
        this.updateDisplay();
    }

    updateDisplay() {
        this.updateGoals();
        this.updateFoodLog();
    }

    updateGoals() {
        const totals = this.foodLog.reduce((acc, food) => {
            acc.calories += food.calories || 0;
            acc.protein += food.protein || 0;
            if (food.antiInflammatory === 'yes') acc.antiInflammatory++;
            if (food.ucSafe === 'safe') acc.ucSafe++;
            return acc;
        }, { calories: 0, protein: 0, antiInflammatory: 0, ucSafe: 0 });

        // Update displays
        document.getElementById('calories-current').textContent = Math.round(totals.calories);
        document.getElementById('protein-current').textContent = Math.round(totals.protein);
        document.getElementById('anti-inflammatory-count').textContent = totals.antiInflammatory;
        document.getElementById('uc-safe-count').textContent = totals.ucSafe;

        // Update progress bars
        const caloriesPercent = Math.min((totals.calories / DAILY_GOALS.calories) * 100, 100);
        const proteinPercent = Math.min((totals.protein / DAILY_GOALS.protein) * 100, 100);

        document.getElementById('calories-progress').style.width = `${caloriesPercent}%`;
        document.getElementById('protein-progress').style.width = `${proteinPercent}%`;

        // Color coding for calories (green if under, orange if near, red if over)
        const caloriesBar = document.getElementById('calories-progress');
        if (totals.calories > DAILY_GOALS.calories) {
            caloriesBar.style.background = '#e57373';
        } else if (totals.calories > DAILY_GOALS.calories * 0.9) {
            caloriesBar.style.background = '#ffb74d';
        } else {
            caloriesBar.style.background = '#ff9800';
        }
    }

    updateFoodLog() {
        const container = document.getElementById('food-log');

        if (this.foodLog.length === 0) {
            container.innerHTML = '<p class="empty-log">No foods logged yet. Start by searching above!</p>';
            return;
        }

        container.innerHTML = this.foodLog.map(food => `
            <div class="food-log-item">
                <div class="food-log-details">
                    <div class="food-log-name">${food.name}</div>
                    <div class="food-log-meta">
                        <span>🔥 ${food.calories} cal</span>
                        <span>💪 ${food.protein}g protein</span>
                    </div>
                    <div class="food-log-badges">
                        ${this.getBadgesHTML(food)}
                    </div>
                    ${food.notes ? `<div class="food-log-notes" style="font-size:0.8rem;color:#666;margin-top:4px;">📝 ${food.notes}</div>` : ''}
                </div>
                <button class="remove-btn" onclick="tracker.removeFood(${food.id})">×</button>
            </div>
        `).join('');
    }

    switchTab(tabId) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    }

    saveToStorage() {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`uc-food-log-${today}`, JSON.stringify(this.foodLog));
    }

    loadFromStorage() {
        const today = new Date().toISOString().split('T')[0];
        const saved = localStorage.getItem(`uc-food-log-${today}`);
        return saved ? JSON.parse(saved) : null;
    }

    clearLog() {
        if (confirm('Are you sure you want to clear today\'s food log?')) {
            this.foodLog = [];
            this.saveToStorage();
            this.updateDisplay();
        }
    }
}

// Initialize the tracker
const tracker = new UCFoodTracker();

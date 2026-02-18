const API_BASE = '/api';
const RATING_CATEGORIES = ['Punctuality', 'Skill', 'Teamwork'];
const PROFILE_STATUSES = ['Full-time', 'Part-time', 'New'];

const form = document.getElementById('rating-form');
const addProfileForm = document.getElementById('add-profile-form');
const addProfileButton = document.getElementById('add-profile');
const cancelAddProfileButton = document.getElementById('cancel-add-profile');
const addProfilePanel = document.getElementById('add-profile-panel');
const addHistoryEntryButton = document.getElementById('add-history-entry');
const profileHistoryList = document.getElementById('profile-history-list');
const profilesList = document.getElementById('profiles');
const clearButton = document.getElementById('clear-data');
const categorySelect = document.getElementById('category');
const workerSelector = document.getElementById('worker-selector');
const workerProfileDetail = document.getElementById('worker-profile-detail');
const rulesForm = document.getElementById('rating-rules-form');
const rulesList = document.getElementById('rating-rules-list');
const ruleSelect = document.getElementById('rating-rule-select');
const applyRuleButton = document.getElementById('apply-rating-rule');

let profilesCache = [];
let ratingRules = [];

const statusFromScore = (score) => {
  if (score >= 8.4) return 'top-performer';
  if (score <= 5) return 'at-risk';
  return 'steady';
};

const fetchProfiles = async () => {
  const response = await fetch(`${API_BASE}/profiles`);
  if (!response.ok) throw new Error('Unable to load profiles');
  return response.json();
};

const saveRating = async (rating) => {
  const response = await fetch(`${API_BASE}/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rating),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Unable to save rating');
  }

  return response.json();
};

const addProfile = async (profile) => {
  const response = await fetch(`${API_BASE}/profiles/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Unable to create profile');
  }

  return response.json();
};

const clearProfiles = async () => {
  const response = await fetch(`${API_BASE}/profiles`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Unable to clear profiles');
};

const loadRatingRules = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RATING_RULES_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((rule) => rule && rule.category && Number.isFinite(Number(rule.score))).map((rule) => ({
      id: String(rule.id || crypto.randomUUID()),
      condition: String(rule.condition || '').trim(),
      category: String(rule.category).trim(),
      score: Number(rule.score),
      note: String(rule.note || '').trim(),
    }));
  } catch {
    return [];
  }
};

const saveRatingRules = () => {
  localStorage.setItem(RATING_RULES_KEY, JSON.stringify(ratingRules));
};

const getKnownCategories = () => {
  const fromRules = ratingRules.map((rule) => rule.category);
  return [...new Set([...RATING_CATEGORIES, ...fromRules])];
};

const buildTrendText = (history) => {
  if (history.length < 2) return 'Not enough history yet';

  const first = history[0].score;
  const latest = history[history.length - 1].score;
  const delta = Number((latest - first).toFixed(2));

  if (delta > 0) return `Improving (+${delta})`;
  if (delta < 0) return `Declining (${delta})`;
  return 'Stable (0.00)';
};

const buildCategoryHistory = (ratings) => {
  const categories = [...new Set([...getKnownCategories(), ...ratings.map((rating) => rating.category)])];
  return categories.reduce((history, category) => {
    history[category] = ratings
      .filter((rating) => rating.category === category)
      .sort((a, b) => new Date(a.ratedAt).getTime() - new Date(b.ratedAt).getTime());
    return history;
  }, {});
};

const renderHistorySummary = (historyEntries) => {
  if (!historyEntries?.length) {
    return '<p class="hint">No profile history entries saved yet.</p>';
  }

  const rows = historyEntries
    .map((entry) => `<li><label><input type="checkbox" checked disabled /> ${entry.category}: ${entry.score}</label></li>`)
    .join('');

  return `<ul class="history-summary">${rows}</ul>`;
};

const renderProfiles = (profiles) => {
  profilesList.innerHTML = '';

  const sorted = [...profiles].sort((a, b) => b.overallScore - a.overallScore);
  if (sorted.length === 0) {
    profilesList.innerHTML = '<li class="profile-item">No workers yet. Add a profile or rating to start building profiles.</li>';
    return;
  }

  sorted.forEach((profile) => {
    const item = document.createElement('li');
    item.className = 'profile-item';
    const badgeClass = profile.ratings.length ? statusFromScore(profile.overallScore) : 'steady';
    const badgeLabel = profile.ratings.length ? badgeClass : 'unrated';
    item.innerHTML = `
      <strong>${profile.name}</strong>
      <div class="meta">
        <span>Status: ${profile.profileStatus || '—'}</span>
        <span>Categories: ${profile.jobCategories.join(', ') || '—'}</span>
        <span>Ratings: ${profile.ratings.length}</span>
        <span>Avg score: ${profile.overallScore}</span>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      ${profile.backgroundInfo ? `<p class="hint">Background: ${profile.backgroundInfo}</p>` : ''}
      <div>
        <h4>Profile history summary</h4>
        ${renderHistorySummary(profile.historyEntries)}
      </div>
    `;
    profilesList.appendChild(item);
  });
};

const renderWorkerSelector = (profiles) => {
  workerSelector.innerHTML = '<option value="">Select a worker profile</option>';

  const sorted = [...profiles].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach((profile) => {
    const option = document.createElement('option');
    option.value = String(profile.id);
    option.textContent = profile.name;
    workerSelector.appendChild(option);
  });
};

const renderWorkerProfile = (profiles, workerId) => {
  if (!workerId) {
    workerProfileDetail.innerHTML = '<p class="hint">Choose a worker to inspect category-level rating history and trends.</p>';
    return;
  }

  const profile = profiles.find((entry) => String(entry.id) === String(workerId));
  if (!profile) {
    workerProfileDetail.innerHTML = '<p class="hint">Worker profile not found.</p>';
    return;
  }

  const categoryHistory = buildCategoryHistory(profile.ratings);

  const categorySections = Object.keys(categoryHistory).map((category) => {
    const history = categoryHistory[category] ?? [];
    const trend = buildTrendText(history);

    const rows = history.length
      ? history
          .map((entry) => {
            const formattedDate = new Date(entry.ratedAt).toLocaleDateString();
            const note = entry.note ? ` — ${entry.note}` : '';
            return `<li>${formattedDate}: ${entry.score} by ${entry.reviewer}${note}</li>`;
          })
          .join('')
      : '<li>No ratings yet.</li>';

    return `
      <article class="category-history">
        <h4>${category}</h4>
        <p class="trend">Trend: ${trend}</p>
        <ul>${rows}</ul>
      </article>
    `;
  }).join('');

  const badgeClass = profile.ratings.length ? statusFromScore(profile.overallScore) : 'steady';
  const badgeLabel = profile.ratings.length ? badgeClass : 'unrated';
  workerProfileDetail.innerHTML = `
    <div class="profile-detail-header">
      <h3>${profile.name}</h3>
      <div class="meta">
        <span>Status: ${profile.profileStatus || '—'}</span>
        <span>Total ratings: ${profile.ratings.length}</span>
        <span>Overall avg: ${profile.overallScore}</span>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      ${profile.backgroundInfo ? `<p class="hint">Background: ${profile.backgroundInfo}</p>` : ''}
    </div>
    <article class="category-history">
      <h4>Saved profile history checklist</h4>
      ${renderHistorySummary(profile.historyEntries)}
    </article>
    <div class="category-history-grid">${categorySections}</div>
  `;
};

const renderAll = (profiles) => {
  renderProfiles(profiles);
  renderWorkerSelector(profiles);
  renderWorkerProfile(profiles, workerSelector.value);
};

const initializeCategoryOptions = () => {
  const previous = categorySelect.value;
  categorySelect.innerHTML = '';

  getKnownCategories().forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  if (previous && getKnownCategories().includes(previous)) {
    categorySelect.value = previous;
  }
};

const renderRuleSelect = () => {
  const previous = ruleSelect.value;
  ruleSelect.innerHTML = '<option value="">No predefined category selected</option>';

  ratingRules.forEach((rule) => {
    const option = document.createElement('option');
    option.value = rule.id;
    const condition = rule.condition ? `${rule.condition} → ` : '';
    option.textContent = `${condition}${rule.category} (${rule.score})`;
    ruleSelect.appendChild(option);
  });

  if (previous && ratingRules.some((rule) => rule.id === previous)) {
    ruleSelect.value = previous;
  }
};

const renderRules = () => {
  rulesList.innerHTML = '';

  if (!ratingRules.length) {
    rulesList.innerHTML = '<li class="profile-item">No rating rules yet. Add one like “Full-time → Was late = -3”.</li>';
    renderRuleSelect();
    initializeCategoryOptions();
    return;
  }

  ratingRules.forEach((rule) => {
    const item = document.createElement('li');
    item.className = 'profile-item rule-item';
    item.innerHTML = `
      <div>
        <strong>${rule.category}</strong>
        <p class="hint">Condition: ${rule.condition || '—'} | Score: ${rule.score}${rule.note ? ` | Note: ${rule.note}` : ''}</p>
      </div>
      <button type="button" class="secondary" data-delete-rule="${rule.id}">Delete</button>
    `;
    rulesList.appendChild(item);
  });

  renderRuleSelect();
  initializeCategoryOptions();
};

const buildHistoryEntryRow = (entry = {}) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'history-entry';

  const selectedCategory = RATING_CATEGORIES.includes(entry.category) ? entry.category : RATING_CATEGORIES[0];
  const selectedScore = Number.isFinite(entry.score) ? entry.score : 5;

  wrapper.innerHTML = `
    <label>
      Category
      <select name="historyCategory" required>
        ${RATING_CATEGORIES.map((category) => `<option value="${category}" ${selectedCategory === category ? 'selected' : ''}>${category}</option>`).join('')}
      </select>
    </label>
    <label>
      Score (1-10)
      <input name="historyScore" type="number" min="1" max="10" step="0.1" value="${selectedScore}" required />
    </label>
    <button type="button" class="secondary remove-history-entry">Remove</button>
  `;

  wrapper.querySelector('.remove-history-entry').addEventListener('click', () => {
    wrapper.remove();
  });

  return wrapper;
};

const resetHistoryEntries = (entries = []) => {
  profileHistoryList.innerHTML = '';
  const sourceEntries = entries.length ? entries : [{}];
  sourceEntries.forEach((entry) => {
    profileHistoryList.appendChild(buildHistoryEntryRow(entry));
  });
};

const initializeStatusOptions = () => {
  const profileStatus = document.getElementById('profileStatus');
  const existing = Array.from(profileStatus.options).map((option) => option.value);

  PROFILE_STATUSES.forEach((status) => {
    if (existing.includes(status)) return;
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    profileStatus.appendChild(option);
  });
};

const collectHistoryEntries = () => {
  return Array.from(profileHistoryList.querySelectorAll('.history-entry'))
    .map((row) => {
      const category = row.querySelector('select[name="historyCategory"]').value.trim();
      const score = Number(row.querySelector('input[name="historyScore"]').value);
      return { category, score };
    })
    .filter((entry) => entry.category && Number.isFinite(entry.score));
};

const refreshFromBackend = async () => {
  profilesCache = await fetchProfiles();
  renderAll(profilesCache);
};

const toggleAddProfilePanel = (show) => {
  addProfilePanel.classList.toggle('hidden', !show);
  if (show) {
    document.getElementById('profileName').focus();
  }
};

const buildRatingPayload = (data) => ({
  workerName: data.get('workerName').toString().trim(),
  category: data.get('category').toString().trim(),
  score: Number(data.get('score')),
  reviewer: data.get('reviewer').toString().trim(),
  note: data.get('note').toString().trim(),
  ratedAt: new Date().toISOString(),
});

const submitRating = async (rating) => {
  const savedProfile = await saveRating(rating);
  await refreshFromBackend();
  workerSelector.value = String(savedProfile.id);
  renderWorkerProfile(profilesCache, savedProfile.id);
  return savedProfile;
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const rating = buildRatingPayload(data);

  try {
    await submitRating(rating);
    form.reset();
    document.getElementById('score').value = '5';
    initializeCategoryOptions();
    ruleSelect.value = '';
  } catch (error) {
    // eslint-disable-next-line no-alert
    alert(error.message);
  }
});

rulesForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = new FormData(rulesForm);
  const category = data.get('ruleCategory').toString().trim();
  const condition = data.get('ruleCondition').toString().trim();
  const note = data.get('ruleNote').toString().trim();
  const score = Number(data.get('ruleScore'));

  if (!category || Number.isNaN(score)) return;

  ratingRules.push({
    id: crypto.randomUUID(),
    condition,
    category,
    score,
    note,
  });

  saveRatingRules();
  renderRules();
  rulesForm.reset();
  document.getElementById('ruleScore').value = '0';
});

rulesList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const ruleId = target.getAttribute('data-delete-rule');
  if (!ruleId) return;

  ratingRules = ratingRules.filter((rule) => rule.id !== ruleId);
  saveRatingRules();
  renderRules();
});

ruleSelect.addEventListener('change', () => {
  const selected = ratingRules.find((rule) => rule.id === ruleSelect.value);
  if (!selected) return;

  categorySelect.value = selected.category;
  document.getElementById('score').value = String(selected.score);

  const noteField = document.getElementById('note');
  if (!noteField.value && selected.note) {
    noteField.value = selected.note;
  }
});

applyRuleButton.addEventListener('click', async () => {
  const selected = ratingRules.find((rule) => rule.id === ruleSelect.value);
  if (!selected) {
    // eslint-disable-next-line no-alert
    alert('Select a predefined category rule first.');
    return;
  }

  const workerName = document.getElementById('workerName').value.trim();
  const reviewer = document.getElementById('reviewer').value.trim();
  if (!workerName || !reviewer) {
    // eslint-disable-next-line no-alert
    alert('Worker name and reviewer are required to apply a predefined rule.');
    return;
  }

  const existingNote = document.getElementById('note').value.trim();
  const combinedNote = [selected.note, existingNote].filter(Boolean).join(' | ');

  const rating = {
    workerName,
    category: selected.category,
    score: selected.score,
    reviewer,
    note: combinedNote,
    ratedAt: new Date().toISOString(),
  };

  try {
    await submitRating(rating);
    document.getElementById('score').value = '5';
    document.getElementById('note').value = '';
  } catch (error) {
    // eslint-disable-next-line no-alert
    alert(error.message);
  }
});

addProfileButton.addEventListener('click', () => {
  toggleAddProfilePanel(true);
});

addHistoryEntryButton.addEventListener('click', () => {
  profileHistoryList.appendChild(buildHistoryEntryRow());
});

cancelAddProfileButton.addEventListener('click', () => {
  addProfileForm.reset();
  resetHistoryEntries();
  toggleAddProfilePanel(false);
});

addProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(addProfileForm);
  const profilePayload = {
    name: data.get('name').toString().trim(),
    status: data.get('status').toString().trim(),
    background: data.get('background').toString().trim(),
    historyEntries: collectHistoryEntries(),
  };

  try {
    const savedProfile = await addProfile(profilePayload);
    await refreshFromBackend();
    workerSelector.value = String(savedProfile.id);
    renderWorkerProfile(profilesCache, savedProfile.id);
    document.getElementById('workerName').value = savedProfile.name;
    addProfileForm.reset();
    resetHistoryEntries();
    toggleAddProfilePanel(false);
  } catch (error) {
    // eslint-disable-next-line no-alert
    alert(error.message);
  }
});

workerSelector.addEventListener('change', () => {
  renderWorkerProfile(profilesCache, workerSelector.value);
});

clearButton.addEventListener('click', async () => {
  try {
    await clearProfiles();
    workerSelector.value = '';
    await refreshFromBackend();
  } catch (error) {
    // eslint-disable-next-line no-alert
    alert(error.message);
  }
});

initializeCategoryOptions();
initializeStatusOptions();
resetHistoryEntries();
refreshFromBackend().catch((error) => {
  workerProfileDetail.innerHTML = `<p class="hint">Backend unavailable: ${error.message}</p>`;
});

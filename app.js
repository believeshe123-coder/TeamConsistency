const API_BASE = '/api';
const RATING_CATEGORIES = ['Punctuality', 'Skill', 'Teamwork'];
const PROFILE_STATUSES = ['Full-time', 'Part-time', 'New'];
const RATING_RULES_KEY = 'worker-rating-rules-v1';
const ADMIN_SETTINGS_KEY = 'worker-admin-settings-v1';
const RATING_CRITERIA_KEY = 'worker-rating-criteria-v1';
const SCORE_CHOICES = [-5, -2.5, 0, 2.5, 5];

const form = document.getElementById('rating-form');
const addProfileForm = document.getElementById('add-profile-form');
const addProfileButton = document.getElementById('add-profile');
const cancelAddProfileButton = document.getElementById('cancel-add-profile');
const addHistoryEntryButton = document.getElementById('add-history-entry');
const addNoteEntryButton = document.getElementById('add-note-entry');
const profileHistoryList = document.getElementById('profile-history-list');
const profileNotesList = document.getElementById('profile-notes-list');
const profilesList = document.getElementById('profiles');
const clearButton = document.getElementById('clear-data');
const categorySelect = document.getElementById('category');
const workerSelector = document.getElementById('worker-selector');
const workerProfileDetail = document.getElementById('worker-profile-detail');
const rulesForm = document.getElementById('rating-rules-form');
const rulesList = document.getElementById('rating-rules-list');
const ruleSelect = document.getElementById('rating-rule-select');
const applyRuleButton = document.getElementById('apply-rating-rule');
const mainPage = document.getElementById('main-page');
const profilePage = document.getElementById('profile-page');
const adminPage = document.getElementById('admin-page');
const tabRatings = document.getElementById('tab-ratings');
const tabAdmin = document.getElementById('tab-admin');
const commonProblemSelect = document.getElementById('common-problem-select');
const adminSettingsForm = document.getElementById('admin-settings-form');
const statusWeightsContainer = document.getElementById('status-weights');
const commonProblemsList = document.getElementById('common-problems-list');
const addCommonProblemButton = document.getElementById('add-common-problem');
const criteriaRatingsContainer = document.getElementById('criterion-ratings');
const ratingCriteriaList = document.getElementById('rating-criteria-list');
const addRatingCriterionButton = document.getElementById('add-rating-criterion');
const workerNameOptions = document.getElementById('worker-name-options');

let profilesCache = [];
let ratingRules = [];
let adminSettings = { statusWeights: {}, commonProblems: [] };
let ratingCriteria = [];
const LOCAL_PROFILES_KEY = 'worker-profiles-local-v1';

const formatTimestamp = (value) => new Date(value).toLocaleString();
const nowIso = () => new Date().toISOString();

const loadLocalProfiles = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_PROFILES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLocalProfiles = (profiles) => {
  localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
};

const recalculateProfileFields = (profile) => {
  const ratings = Array.isArray(profile.ratings) ? profile.ratings : [];
  const jobCategories = [...new Set(ratings.map((entry) => entry.category).filter(Boolean))];
  const overallScore = ratings.length
    ? Number((ratings.reduce((total, entry) => total + Number(entry.score || 0), 0) / ratings.length).toFixed(2))
    : 0;

  return {
    ...profile,
    jobCategories,
    overallScore,
  };
};

const upsertLocalProfile = (incomingProfile) => {
  const profiles = loadLocalProfiles();
  const normalizedName = String(incomingProfile.name || '').trim().toLowerCase();
  const existingIndex = profiles.findIndex((entry) => String(entry.name || '').trim().toLowerCase() === normalizedName);
  const nextId = existingIndex >= 0 ? profiles[existingIndex].id : Date.now();
  const previous = existingIndex >= 0 ? profiles[existingIndex] : null;

  const merged = recalculateProfileFields({
    id: nextId,
    name: incomingProfile.name,
    profileStatus: incomingProfile.status || incomingProfile.profileStatus || '',
    backgroundInfo: incomingProfile.background || incomingProfile.backgroundInfo || '',
    ratings: previous?.ratings || [],
    historyEntries: incomingProfile.historyEntries || [],
    profileNotes: incomingProfile.profileNotes || [],
    createdAt: previous?.createdAt || nowIso(),
    updatedAt: nowIso(),
  });

  if (existingIndex >= 0) {
    profiles[existingIndex] = merged;
  } else {
    profiles.push(merged);
  }

  saveLocalProfiles(profiles);
  return merged;
};

const statusFromScore = (score) => {
  if (score >= 2.5) return 'top-performer';
  if (score <= -2.5) return 'at-risk';
  return 'steady';
};

const getStatusWeight = (status) => Number(adminSettings.statusWeights?.[status] || 0);

const getCommonProblemWeight = (noteText) => {
  const normalized = String(noteText || '').trim().toLowerCase();
  if (!normalized) return 0;

  return (adminSettings.commonProblems || []).reduce((total, problem) => {
    const name = String(problem.name || '').trim().toLowerCase();
    if (!name) return total;
    if (!normalized.includes(name)) return total;
    return total + Number(problem.weight || 0);
  }, 0);
};

const computeRankScore = (profile) => {
  const statusWeight = getStatusWeight(profile.profileStatus);
  const commonProblemPenalty = (profile.ratings || []).reduce((total, entry) => total + getCommonProblemWeight(entry.note), 0);
  const rankScore = Number((Number(profile.overallScore || 0) + statusWeight + commonProblemPenalty).toFixed(2));
  return { rankScore, statusWeight, commonProblemPenalty };
};

const statusLabelFromClass = (badgeClass) => {
  if (badgeClass === 'top-performer') return 'Top performer';
  if (badgeClass === 'at-risk') return 'At risk';
  if (badgeClass === 'steady') return 'Steady';
  return 'Unrated';
};

const fetchProfiles = async () => {
  try {
    const response = await fetch(`${API_BASE}/profiles`);
    if (!response.ok) throw new Error('Unable to load profiles');
    return response.json();
  } catch {
    return loadLocalProfiles();
  }
};

const saveRating = async (rating) => {
  try {
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
  } catch {
    const profiles = loadLocalProfiles();
    const normalizedName = String(rating.workerName || '').trim().toLowerCase();
    const profileIndex = profiles.findIndex((entry) => String(entry.name || '').trim().toLowerCase() === normalizedName);
    const now = rating.ratedAt || nowIso();
    const ratingEntry = {
      id: Date.now(),
      category: rating.category,
      score: Number(rating.score),
      reviewer: rating.reviewer,
      note: rating.note || '',
      ratedAt: now,
    };

    let profile;
    if (profileIndex >= 0) {
      profile = {
        ...profiles[profileIndex],
        ratings: [...(profiles[profileIndex].ratings || []), ratingEntry],
        updatedAt: now,
      };
      profiles[profileIndex] = recalculateProfileFields(profile);
      profile = profiles[profileIndex];
    } else {
      profile = recalculateProfileFields({
        id: Date.now(),
        name: rating.workerName,
        profileStatus: '',
        backgroundInfo: '',
        ratings: [ratingEntry],
        historyEntries: [],
        profileNotes: [],
        createdAt: now,
        updatedAt: now,
      });
      profiles.push(profile);
    }

    saveLocalProfiles(profiles);
    return profile;
  }
};

const addProfile = async (profile) => {
  try {
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
  } catch {
    return upsertLocalProfile(profile);
  }
};

const clearProfiles = async () => {
  try {
    const response = await fetch(`${API_BASE}/profiles`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Unable to clear profiles');
  } catch {
    saveLocalProfiles([]);
  }
};

const loadAdminSettings = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || '{}');
    const statusWeights = PROFILE_STATUSES.reduce((acc, status) => {
      acc[status] = Number(parsed?.statusWeights?.[status] || 0);
      return acc;
    }, {});

    const commonProblems = Array.isArray(parsed?.commonProblems)
      ? parsed.commonProblems
          .filter((item) => item && String(item.name || '').trim())
          .map((item) => ({ id: String(item.id || crypto.randomUUID()), name: String(item.name).trim(), weight: Number(item.weight || 0) }))
      : [];

    return { statusWeights, commonProblems };
  } catch {
    return {
      statusWeights: PROFILE_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {}),
      commonProblems: [],
    };
  }
};

const saveAdminSettings = () => {
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(adminSettings));
};

const defaultRatingCriteria = () => ([
  {
    id: crypto.randomUUID(),
    name: 'Late / on time',
    labels: {
      '-5': 'Extremely late',
      '-2.5': 'A bit late',
      '0': 'On time',
      '2.5': 'Slightly early',
      '5': 'Extremely early',
    },
  },
  {
    id: crypto.randomUUID(),
    name: 'Work quality',
    labels: {
      '-5': 'Extremely bad',
      '-2.5': 'A little bad',
      '0': 'No / average',
      '2.5': 'A little good',
      '5': 'Extremely good',
    },
  },
]);

const loadRatingCriteria = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RATING_CRITERIA_KEY) || '[]');
    if (!Array.isArray(parsed) || !parsed.length) return defaultRatingCriteria();

    const normalized = parsed
      .filter((item) => item && String(item.name || '').trim())
      .map((item) => {
        const labels = item.labels || {};
        return {
          id: String(item.id || crypto.randomUUID()),
          name: String(item.name || '').trim(),
          labels: {
            '-5': String(labels['-5'] || 'Extremely bad').trim(),
            '-2.5': String(labels['-2.5'] || 'A little bad').trim(),
            '0': String(labels['0'] || 'No / average').trim(),
            '2.5': String(labels['2.5'] || 'A little good').trim(),
            '5': String(labels['5'] || 'Extremely good').trim(),
          },
        };
      });

    return normalized.length ? normalized : defaultRatingCriteria();
  } catch {
    return defaultRatingCriteria();
  }
};

const saveRatingCriteria = () => {
  localStorage.setItem(RATING_CRITERIA_KEY, JSON.stringify(ratingCriteria));
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

const renderProfileNotesTimeline = (profileNotes) => {
  if (!profileNotes?.length) {
    return '<p class="hint">No timed profile notes saved yet.</p>';
  }

  const rows = profileNotes
    .map((entry) => `<li><strong>${formatTimestamp(entry.createdAt)}:</strong> ${entry.note}</li>`)
    .join('');

  return `<ul class="history-summary">${rows}</ul>`;
};

const renderHistorySummary = (historyEntries) => {
  if (!historyEntries?.length) {
    return '<p class="hint">No profile history entries saved yet.</p>';
  }

  const rows = historyEntries
    .map((entry) => {
      const detail = entry.note ? ` — ${entry.note}` : '';
      return `<li><label><input type="checkbox" checked disabled /> ${entry.category}: ${entry.score}${detail} <span class="hint">(${formatTimestamp(entry.createdAt)})</span></label></li>`;
    })
    .join('');

  return `<ul class="history-summary">${rows}</ul>`;
};

const renderProfiles = (profiles) => {
  profilesList.innerHTML = '';

  const sorted = [...profiles].sort((a, b) => computeRankScore(b).rankScore - computeRankScore(a).rankScore);
  if (sorted.length === 0) {
    profilesList.innerHTML = '<li class="profile-item">No workers yet. Add a profile or rating to start building profiles.</li>';
    return;
  }

  sorted.forEach((profile) => {
    const item = document.createElement('li');
    item.className = 'profile-item';
    const badgeClass = profile.ratings.length ? statusFromScore(profile.overallScore) : 'steady';
    const badgeLabel = profile.ratings.length ? statusLabelFromClass(badgeClass) : 'Unrated';
    const latestNote = profile.profileNotes?.length ? profile.profileNotes[profile.profileNotes.length - 1] : null;
    const { rankScore, statusWeight, commonProblemPenalty } = computeRankScore(profile);

    item.innerHTML = `
      <strong>${profile.name}</strong>
      <div class="meta">
        <span>Status: ${profile.profileStatus || '—'}</span>
        <span>Categories: ${profile.jobCategories.join(', ') || '—'}</span>
        <span>Ratings: ${profile.ratings.length}</span>
        <span>Avg score: ${profile.overallScore}</span>
        <span>Rank score: ${rankScore}</span>
        <span>Status weight: ${statusWeight}</span>
        <span>Common problem weight: ${commonProblemPenalty}</span>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      ${profile.backgroundInfo ? `<p class="hint">Background: ${profile.backgroundInfo}</p>` : ''}
      ${latestNote ? `<p class="hint">Latest timed note (${formatTimestamp(latestNote.createdAt)}): ${latestNote.note}</p>` : ''}
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

const renderWorkerNameSuggestions = (profiles) => {
  if (!workerNameOptions) return;
  workerNameOptions.innerHTML = '';

  [...profiles]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((profile) => {
      const option = document.createElement('option');
      option.value = profile.name;
      workerNameOptions.appendChild(option);
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
            const formattedDate = new Date(entry.ratedAt).toLocaleString();
            const note = entry.note ? ` — ${entry.note}` : '';
            return `<li>${formattedDate}: ${entry.score}${note}</li>`;
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
  const badgeLabel = profile.ratings.length ? statusLabelFromClass(badgeClass) : 'Unrated';
  const { rankScore, statusWeight, commonProblemPenalty } = computeRankScore(profile);
  workerProfileDetail.innerHTML = `
    <div class="profile-detail-header">
      <h3>${profile.name}</h3>
      <div class="meta">
        <span>Status: ${profile.profileStatus || '—'}</span>
        <span>Total ratings: ${profile.ratings.length}</span>
        <span>Overall avg: ${profile.overallScore}</span>
        <span>Rank score: ${rankScore}</span>
        <span>Status weight: ${statusWeight}</span>
        <span>Common problem weight: ${commonProblemPenalty}</span>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      ${profile.backgroundInfo ? `<p class="hint">Background: ${profile.backgroundInfo}</p>` : ''}
    </div>
    <article class="category-history">
      <h4>Saved profile history checklist</h4>
      ${renderHistorySummary(profile.historyEntries)}
    </article>
    <article class="category-history">
      <h4>Timed profile notes</h4>
      ${renderProfileNotesTimeline(profile.profileNotes)}
    </article>
    <div class="category-history-grid">${categorySections}</div>
  `;
};

const renderCommonProblemSelect = () => {
  if (!commonProblemSelect) return;

  commonProblemSelect.innerHTML = '<option value="">No quick pick selected</option>';

  (adminSettings.commonProblems || []).forEach((problem) => {
    const option = document.createElement('option');
    option.value = problem.id;
    option.textContent = `${problem.name} (${problem.weight})`;
    commonProblemSelect.appendChild(option);
  });
};

const renderAdminSettings = () => {
  if (!statusWeightsContainer || !commonProblemsList) return;

  statusWeightsContainer.innerHTML = PROFILE_STATUSES.map((status) => `
    <label>
      <span class="label-text">${status}</span>
      <input type="number" step="0.1" data-status-weight="${status}" value="${Number(adminSettings.statusWeights?.[status] || 0)}" />
    </label>
  `).join('');

  commonProblemsList.innerHTML = '';

  if (!(adminSettings.commonProblems || []).length) {
    commonProblemsList.innerHTML = '<p class="hint">No common problems yet.</p>';
  }

  (adminSettings.commonProblems || []).forEach((problem) => {
    const row = document.createElement('div');
    row.className = 'problem-row';
    row.innerHTML = `
      <span><strong>${problem.name}</strong> (weight: ${problem.weight})</span>
      <button type="button" class="secondary" data-delete-problem="${problem.id}">Delete</button>
    `;
    commonProblemsList.appendChild(row);
  });

  renderCommonProblemSelect();
};

const renderRatingCriteriaRows = () => {
  if (!ratingCriteriaList) return;

  ratingCriteriaList.innerHTML = '';

  if (!ratingCriteria.length) {
    ratingCriteriaList.innerHTML = '<p class="hint">No checklist items yet.</p>';
    return;
  }

  ratingCriteria.forEach((criterion) => {
    const row = document.createElement('div');
    row.className = 'problem-row';
    row.innerHTML = `
      <span><strong>${criterion.name}</strong> — ${criterion.labels['-5']} | ${criterion.labels['-2.5']} | ${criterion.labels['0']} | ${criterion.labels['2.5']} | ${criterion.labels['5']}</span>
      <button type="button" class="secondary" data-delete-criterion="${criterion.id}">Delete</button>
    `;
    ratingCriteriaList.appendChild(row);
  });
};

const renderCriterionRatings = () => {
  if (!criteriaRatingsContainer) return;

  criteriaRatingsContainer.innerHTML = '';

  ratingCriteria.forEach((criterion) => {
    const row = document.createElement('div');
    row.className = 'criterion-rating-row';
    row.innerHTML = `
      <label class="criterion-toggle">
        <input type="checkbox" data-criterion-toggle="${criterion.id}" />
        <span>${criterion.name}</span>
      </label>
      <div class="criterion-scale hidden" data-criterion-scale="${criterion.id}">
        ${SCORE_CHOICES.map((value) => `<label><input type="radio" name="criterion-${criterion.id}" value="${value}" ${value === 0 ? 'checked' : ''} /> <span>${criterion.labels[String(value)]}</span></label>`).join('')}
      </div>
    `;
    criteriaRatingsContainer.appendChild(row);
  });
};

const renderAll = (profiles) => {
  renderProfiles(profiles);
  renderWorkerSelector(profiles);
  renderWorkerNameSuggestions(profiles);
  renderWorkerProfile(profiles, workerSelector.value);
  renderCommonProblemSelect();
  renderCriterionRatings();
  renderRatingCriteriaRows();
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
  if (!ruleSelect) return;

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
  if (!rulesList) {
    renderRuleSelect();
    initializeCategoryOptions();
    return;
  }

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
  const createdAt = entry.createdAt || nowIso();

  wrapper.innerHTML = `
    <label>
      Category
      <select name="historyCategory" required>
        ${RATING_CATEGORIES.map((category) => `<option value="${category}" ${selectedCategory === category ? 'selected' : ''}>${category}</option>`).join('')}
      </select>
    </label>
    <label>
      Score (-5 to 5)
      <input name="historyScore" type="number" min="-5" max="5" step="0.1" value="${selectedScore}" required />
    </label>
    <label>
      History note
      <input name="historyNote" type="text" value="${entry.note || ''}" placeholder="Arrived early all week" />
    </label>
    <label>
      Added at
      <input name="historyCreatedAt" type="text" value="${createdAt}" readonly />
    </label>
    <button type="button" class="secondary remove-history-entry">Remove</button>
  `;

  wrapper.querySelector('.remove-history-entry').addEventListener('click', () => {
    wrapper.remove();
  });

  return wrapper;
};

const buildNoteEntryRow = (entry = {}) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'history-entry';

  const createdAt = entry.createdAt || nowIso();

  wrapper.innerHTML = `
    <label>
      Profile note
      <input name="profileNote" type="text" value="${entry.note || ''}" placeholder="Prefers closing shift" required />
    </label>
    <label>
      Added at
      <input name="profileNoteCreatedAt" type="text" value="${createdAt}" readonly />
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
  entries.forEach((entry) => {
    profileHistoryList.appendChild(buildHistoryEntryRow(entry));
  });
};

const resetNoteEntries = (entries = []) => {
  profileNotesList.innerHTML = '';
  entries.forEach((entry) => {
    profileNotesList.appendChild(buildNoteEntryRow(entry));
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
      const note = row.querySelector('input[name="historyNote"]').value.trim();
      const createdAt = row.querySelector('input[name="historyCreatedAt"]').value;
      return { category, score, note, createdAt };
    })
    .filter((entry) => entry.category && Number.isFinite(entry.score) && entry.score >= -5 && entry.score <= 5);
};

const collectProfileNotes = () => {
  return Array.from(profileNotesList.querySelectorAll('.history-entry'))
    .map((row) => {
      const note = row.querySelector('input[name="profileNote"]').value.trim();
      const createdAt = row.querySelector('input[name="profileNoteCreatedAt"]').value;
      return { note, createdAt };
    })
    .filter((entry) => entry.note);
};

const refreshFromBackend = async () => {
  profilesCache = await fetchProfiles();
  renderAll(profilesCache);
};

const showProfilePage = (show) => {
  mainPage.classList.toggle('hidden', show);
  profilePage.classList.toggle('hidden', !show);
  adminPage.classList.add('hidden');

  tabRatings.classList.add('active');
  tabAdmin.classList.remove('active');
  tabRatings.setAttribute('aria-selected', 'true');
  tabAdmin.setAttribute('aria-selected', 'false');

  if (show) {
    history.pushState({ profilePage: true }, '', '#add-profile');
    document.getElementById('profileName').focus();
  } else if (window.location.hash === '#add-profile') {
    history.pushState({}, '', '#');
  }
};

const showAdminPage = (show) => {
  mainPage.classList.toggle('hidden', show);
  profilePage.classList.add('hidden');
  adminPage.classList.toggle('hidden', !show);

  tabRatings.classList.toggle('active', !show);
  tabAdmin.classList.toggle('active', show);
  tabRatings.setAttribute('aria-selected', String(!show));
  tabAdmin.setAttribute('aria-selected', String(show));

  if (show) {
    history.pushState({ adminPage: true }, '', '#admin-settings');
  } else if (window.location.hash === '#admin-settings') {
    history.pushState({}, '', '#');
  }
};

const buildRatingPayload = (data) => {
  const selectedProblem = (adminSettings.commonProblems || []).find((problem) => problem.id === commonProblemSelect?.value);
  const noteText = data.get('note').toString().trim();
  const goodNotes = data.get('goodNotes').toString().trim();
  const badNotes = data.get('badNotes').toString().trim();
  const selectedCriteria = ratingCriteria
    .filter((criterion) => {
      const toggle = form.querySelector(`[data-criterion-toggle="${criterion.id}"]`);
      return toggle?.checked;
    })
    .map((criterion) => {
      const scoreField = form.querySelector(`input[name="criterion-${criterion.id}"]:checked`);
      const score = Number(scoreField?.value ?? 0);
      const label = criterion.labels[String(score)] || '';
      return { criterion: criterion.name, score, label };
    });

  const checklistAverage = selectedCriteria.length
    ? Number((selectedCriteria.reduce((total, entry) => total + entry.score, 0) / selectedCriteria.length).toFixed(2))
    : null;

  const note = [
    selectedProblem?.name,
    selectedCriteria.length ? `Checklist: ${selectedCriteria.map((entry) => `${entry.criterion}=${entry.label} (${entry.score})`).join('; ')}` : '',
    goodNotes ? `Good: ${goodNotes}` : '',
    badNotes ? `Needs work: ${badNotes}` : '',
    noteText,
  ].filter(Boolean).join(' | ');

  return {
    workerName: data.get('workerName').toString().trim(),
    category: data.get('category').toString().trim(),
    score: checklistAverage,
    reviewer: 'Anonymous',
    note,
    ratedAt: nowIso(),
  };
};

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

  if (!Number.isFinite(rating.score)) {
    // eslint-disable-next-line no-alert
    alert('Select at least one checklist item to create a rating.');
    return;
  }

  try {
    await submitRating(rating);
    form.reset();
    initializeCategoryOptions();
    renderCriterionRatings();
    if (ruleSelect) {
      ruleSelect.value = '';
    }
  } catch (error) {
    // eslint-disable-next-line no-alert
    alert(error.message);
  }
});

if (rulesForm) {
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
}

if (rulesList) {
  rulesList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const ruleId = target.getAttribute('data-delete-rule');
    if (!ruleId) return;

    ratingRules = ratingRules.filter((rule) => rule.id !== ruleId);
    saveRatingRules();
    renderRules();
  });
}

if (ruleSelect) {
  ruleSelect.addEventListener('change', () => {
    const selected = ratingRules.find((rule) => rule.id === ruleSelect.value);
    if (!selected) return;

    categorySelect.value = selected.category;
    const noteField = document.getElementById('note');
    if (!noteField.value && selected.note) {
      noteField.value = selected.note;
    }
  });
}

if (applyRuleButton) {
  applyRuleButton.addEventListener('click', async () => {
    const selected = ratingRules.find((rule) => rule.id === ruleSelect.value);
    if (!selected) {
      // eslint-disable-next-line no-alert
      alert('Select a predefined category rule first.');
      return;
    }

    const workerName = document.getElementById('workerName').value.trim();
    if (!workerName) {
      // eslint-disable-next-line no-alert
      alert('Worker name is required to apply a predefined rule.');
      return;
    }

    const existingNote = document.getElementById('note').value.trim();
    const combinedNote = [selected.note, existingNote].filter(Boolean).join(' | ');

    const rating = {
      workerName,
      category: selected.category,
      score: selected.score,
      reviewer: 'Anonymous',
      note: combinedNote,
      ratedAt: nowIso(),
    };

    try {
      await submitRating(rating);
      document.getElementById('note').value = '';
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(error.message);
    }
  });
}

if (tabRatings) {
  tabRatings.addEventListener('click', () => {
    showAdminPage(false);
    showProfilePage(false);
  });
}

if (tabAdmin) {
  tabAdmin.addEventListener('click', () => {
    showAdminPage(true);
  });
}

if (addCommonProblemButton) {
  addCommonProblemButton.addEventListener('click', () => {
    const nameField = document.getElementById('problem-name');
    const weightField = document.getElementById('problem-weight');
    const name = nameField.value.trim();
    const weight = Number(weightField.value);

    if (!name || Number.isNaN(weight)) return;

    adminSettings.commonProblems.push({ id: crypto.randomUUID(), name, weight });
    nameField.value = '';
    weightField.value = '-2';
    renderAdminSettings();
  });
}

if (commonProblemsList) {
  commonProblemsList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const problemId = target.getAttribute('data-delete-problem');
    if (!problemId) return;

    adminSettings.commonProblems = adminSettings.commonProblems.filter((problem) => problem.id !== problemId);
    renderAdminSettings();
  });
}

if (adminSettingsForm) {
  adminSettingsForm.addEventListener('submit', (event) => {
    event.preventDefault();

    PROFILE_STATUSES.forEach((status) => {
      const field = statusWeightsContainer.querySelector(`[data-status-weight="${status}"]`);
      adminSettings.statusWeights[status] = Number(field?.value || 0);
    });

    saveAdminSettings();
    renderAdminSettings();
    renderAll(profilesCache);
  });
}

if (criteriaRatingsContainer) {
  criteriaRatingsContainer.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const criterionId = target.getAttribute('data-criterion-toggle');
    if (!criterionId) return;

    const scale = criteriaRatingsContainer.querySelector(`[data-criterion-scale="${criterionId}"]`);
    scale?.classList.toggle('hidden', !target.checked);
  });
}

if (addRatingCriterionButton) {
  addRatingCriterionButton.addEventListener('click', () => {
    const name = document.getElementById('criterion-name').value.trim();
    const veryBad = document.getElementById('criterion-very-bad').value.trim();
    const littleBad = document.getElementById('criterion-little-bad').value.trim();
    const neutral = document.getElementById('criterion-neutral').value.trim();
    const littleGood = document.getElementById('criterion-little-good').value.trim();
    const veryGood = document.getElementById('criterion-very-good').value.trim();

    if (!name) return;

    ratingCriteria.push({
      id: crypto.randomUUID(),
      name,
      labels: {
        '-5': veryBad || 'Extremely bad',
        '-2.5': littleBad || 'A little bad',
        '0': neutral || 'No / average',
        '2.5': littleGood || 'A little good',
        '5': veryGood || 'Extremely good',
      },
    });

    ['criterion-name', 'criterion-very-bad', 'criterion-little-bad', 'criterion-neutral', 'criterion-little-good', 'criterion-very-good'].forEach((fieldId) => {
      document.getElementById(fieldId).value = '';
    });

    saveRatingCriteria();
    renderRatingCriteriaRows();
    renderCriterionRatings();
  });
}

if (ratingCriteriaList) {
  ratingCriteriaList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const criterionId = target.getAttribute('data-delete-criterion');
    if (!criterionId) return;

    ratingCriteria = ratingCriteria.filter((criterion) => criterion.id !== criterionId);
    saveRatingCriteria();
    renderRatingCriteriaRows();
    renderCriterionRatings();
  });
}

addProfileButton.addEventListener('click', () => {
  showProfilePage(true);
});

addHistoryEntryButton.addEventListener('click', () => {
  profileHistoryList.appendChild(buildHistoryEntryRow());
});

addNoteEntryButton.addEventListener('click', () => {
  profileNotesList.appendChild(buildNoteEntryRow());
});

cancelAddProfileButton.addEventListener('click', () => {
  addProfileForm.reset();
  resetHistoryEntries();
  resetNoteEntries();
  showProfilePage(false);
});

addProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(addProfileForm);
  const profilePayload = {
    name: data.get('name').toString().trim(),
    status: data.get('status').toString().trim(),
    background: data.get('background').toString().trim(),
    historyEntries: collectHistoryEntries(),
    profileNotes: collectProfileNotes(),
  };

  try {
    const savedProfile = await addProfile(profilePayload);
    await refreshFromBackend();
    workerSelector.value = String(savedProfile.id);
    renderWorkerProfile(profilesCache, savedProfile.id);
    document.getElementById('workerName').value = savedProfile.name;
    addProfileForm.reset();
    resetHistoryEntries();
    resetNoteEntries();
    showProfilePage(false);
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

window.addEventListener('popstate', () => {
  const hash = window.location.hash;
  if (hash === '#admin-settings') {
    showAdminPage(true);
    return;
  }

  showAdminPage(false);
  showProfilePage(hash === '#add-profile');
});

adminSettings = loadAdminSettings();
ratingRules = loadRatingRules();
ratingCriteria = loadRatingCriteria();
initializeCategoryOptions();
initializeStatusOptions();
renderRules();
renderAdminSettings();
resetHistoryEntries();
resetNoteEntries();
if (window.location.hash === '#admin-settings') {
  showAdminPage(true);
} else {
  showAdminPage(false);
  showProfilePage(window.location.hash === '#add-profile');
}
refreshFromBackend().catch((error) => {
  workerProfileDetail.innerHTML = `<p class="hint">Backend unavailable: ${error.message}</p>`;
});

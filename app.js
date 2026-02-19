const API_BASE = '/api';
const RATING_CATEGORIES = ['Punctuality', 'Skill', 'Teamwork'];
const PROFILE_STATUSES = ['Full-time', 'Part-time', 'New'];
const RATING_RULES_KEY = 'worker-rating-rules-v1';
const ADMIN_SETTINGS_KEY = 'worker-admin-settings-v1';
const RATING_CRITERIA_KEY = 'worker-rating-criteria-v1';
const SCORE_CHOICES = [-5, -2.5, 0, 2.5, 5];
const ADMIN_ACCESS_PASSWORD_KEY = 'worker-admin-access-password-v1';
const ADMIN_ACCESS_SESSION_KEY = 'worker-admin-access-session-v1';
const DEFAULT_ADMIN_ACCESS_PASSWORD = '1234';

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
const jobTypeSelect = document.getElementById('job-type');
const workerSelector = document.getElementById('worker-selector');
const workerProfileDetail = document.getElementById('worker-profile-detail');
const rulesForm = document.getElementById('rating-rules-form');
const rulesList = document.getElementById('rating-rules-list');
const ruleSelect = document.getElementById('rating-rule-select');
const mainPage = document.getElementById('main-page');
const profilePage = document.getElementById('profile-page');
const adminPage = document.getElementById('admin-page');
const tabRatings = document.getElementById('tab-ratings');
const tabAdmin = document.getElementById('tab-admin');
const adminSettingsForm = document.getElementById('admin-settings-form');
const lockAdminButton = document.getElementById('lock-admin');
const saveAdminPasswordButton = document.getElementById('save-admin-password');
const adminPasswordInput = document.getElementById('admin-password');
const adminAccessFeedback = document.getElementById('admin-access-feedback');
const statusWeightsContainer = document.getElementById('status-weights');
const jobTypesList = document.getElementById('job-types-list');
const addJobTypeButton = document.getElementById('add-job-type');
const criteriaRatingsContainer = document.getElementById('criterion-ratings');
const ratingCriteriaList = document.getElementById('rating-criteria-list');
const addRatingCriterionButton = document.getElementById('add-rating-criterion');
const checklistMathRulesList = document.getElementById('checklist-math-rules-list');
const mathMainCriterionSelect = document.getElementById('math-main-criterion');
const mathLabelSelect = document.getElementById('math-label');
const mathReportRangeInput = document.getElementById('math-report-range');
const mathWeightMultiplierInput = document.getElementById('math-weight-multiplier');
const mathTagInput = document.getElementById('math-tag');
const customTagsList = document.getElementById('custom-tags-list');
const customTagNameInput = document.getElementById('custom-tag-name');
const customTagColorInput = document.getElementById('custom-tag-color');
const addCustomTagButton = document.getElementById('add-custom-tag');
const mathInsightInput = document.getElementById('math-insight');
const addChecklistMathRuleButton = document.getElementById('add-checklist-math-rule');
const workerNameSelect = document.getElementById('workerName');
const quickAddWorkerButton = document.getElementById('quick-add-worker');
const quickWorkerNameInput = document.getElementById('quick-worker-name');
const quickWorkerFeedback = document.getElementById('quick-worker-feedback');

let profilesCache = [];
let ratingRules = [];
let adminSettings = { statusWeights: {}, jobTypes: [], checklistMathRules: [], customTags: [] };
let ratingCriteria = [];
let adminAccessUnlocked = localStorage.getItem(ADMIN_ACCESS_SESSION_KEY) === 'unlocked';
const LOCAL_PROFILES_KEY = 'worker-profiles-local-v1';

const formatTimestamp = (value) => new Date(value).toLocaleString();
const nowIso = () => new Date().toISOString();

const DEFAULT_STEADY_TAG = { id: 'steady-default', label: 'Steady', color: '#5f8df5', locked: true };

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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toFivePointScale = (rawScore) => Number((((clamp(Number(rawScore) || 0, -5, 5) + 5) / 2)).toFixed(2));
const isPunctualityCategory = (category) => ['punctuality', 'attendance', 'timeliness', 'late'].some((token) => String(category || '').toLowerCase().includes(token));

const computeProfileAnalytics = (ratings) => {
  if (!ratings.length) {
    return {
      normalizedOverallScore: 0,
      consistencyScore: 0,
      currentPositiveStreak: 0,
      bestPositiveStreak: 0,
      lateTrendWeightApplied: false,
      lateTrend: 'No punctuality trend yet',
    };
  }

  const sorted = [...ratings].sort((a, b) => new Date(a.ratedAt).getTime() - new Date(b.ratedAt).getTime());
  const punctualityRatings = sorted.filter((entry) => isPunctualityCategory(entry.category));
  const recentPunctuality = punctualityRatings.slice(-3);
  const lateTrendWeightApplied = recentPunctuality.length === 3 && recentPunctuality.every((entry) => Number(entry.score) <= 0);

  const normalizedScores = [];
  let currentPositiveStreak = 0;
  let bestPositiveStreak = 0;

  const weightedTotal = sorted.reduce((sum, entry) => {
    const normalizedScore = toFivePointScale(entry.score);
    normalizedScores.push(normalizedScore);

    if (normalizedScore >= 3.5) {
      currentPositiveStreak += 1;
      bestPositiveStreak = Math.max(bestPositiveStreak, currentPositiveStreak);
    } else {
      currentPositiveStreak = 0;
    }

    const multiplier = lateTrendWeightApplied && isPunctualityCategory(entry.category) ? 2 : 1;
    return sum + (Number(entry.score || 0) * multiplier);
  }, 0);

  const weightedAverage = weightedTotal / sorted.length;
  const streakBonus = Math.min(0.5, currentPositiveStreak * 0.1);
  const normalizedOverallScore = Number(clamp(toFivePointScale(weightedAverage) + streakBonus, 0, 5).toFixed(2));

  const mean = normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length;
  const variance = normalizedScores.reduce((sum, score) => sum + ((score - mean) ** 2), 0) / normalizedScores.length;
  const consistencyScore = Number(clamp(100 - (Math.sqrt(variance) * 20), 0, 100).toFixed(2));

  return {
    normalizedOverallScore,
    consistencyScore,
    currentPositiveStreak,
    bestPositiveStreak,
    lateTrendWeightApplied,
    lateTrend: lateTrendWeightApplied ? 'Always late trend detected; punctuality scores are doubled' : (recentPunctuality.length ? 'Punctuality is being monitored' : 'No punctuality trend yet'),
  };
};

const recalculateProfileFields = (profile) => {
  const ratings = Array.isArray(profile.ratings) ? profile.ratings : [];
  const jobCategories = [...new Set(ratings.map((entry) => entry.category).filter(Boolean))];
  const analytics = computeProfileAnalytics(ratings);

  return {
    ...profile,
    jobCategories,
    overallScore: analytics.normalizedOverallScore,
    analytics,
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
  if (score >= 4) return 'top-performer';
  if (score <= 2) return 'at-risk';
  return 'steady';
};

const getStatusWeight = (status) => Number(adminSettings.statusWeights?.[status] || 0);

const computeRankScore = (profile) => {
  const statusWeight = getStatusWeight(profile.profileStatus);
  const rankScore = Number((Number(profile.overallScore || 0) + statusWeight).toFixed(2));
  return { rankScore, statusWeight };
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

const deleteProfileRating = async (profileId, ratingId) => {
  try {
    const response = await fetch(`${API_BASE}/profiles/${profileId}/ratings/${ratingId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Unable to delete rating');
    return response.json();
  } catch {
    const profiles = loadLocalProfiles();
    const profileIndex = profiles.findIndex((entry) => String(entry.id) === String(profileId));
    if (profileIndex < 0) throw new Error('Profile not found');

    const profile = profiles[profileIndex];
    const filteredRatings = (profile.ratings || []).filter((entry) => String(entry.id) !== String(ratingId));
    profiles[profileIndex] = recalculateProfileFields({ ...profile, ratings: filteredRatings, updatedAt: nowIso() });
    saveLocalProfiles(profiles);
    return profiles[profileIndex];
  }
};

const deleteProfileNote = async (profileId, noteId) => {
  try {
    const response = await fetch(`${API_BASE}/profiles/${profileId}/notes/${noteId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Unable to delete note');
    return response.json();
  } catch {
    const profiles = loadLocalProfiles();
    const profileIndex = profiles.findIndex((entry) => String(entry.id) === String(profileId));
    if (profileIndex < 0) throw new Error('Profile not found');

    const profile = profiles[profileIndex];
    const filteredNotes = (profile.profileNotes || []).filter((entry) => String(entry.id) !== String(noteId));
    profiles[profileIndex] = recalculateProfileFields({ ...profile, profileNotes: filteredNotes, updatedAt: nowIso() });
    saveLocalProfiles(profiles);
    return profiles[profileIndex];
  }
};

const DEFAULT_JOB_TYPES = ['Loading dock', 'Warehouse', 'Picker'];

const normalizeCustomTags = (tags) => {
  const source = Array.isArray(tags) ? tags : [];
  const normalized = source
    .filter((tag) => tag && String(tag.label || '').trim())
    .map((tag) => ({
      id: String(tag.id || crypto.randomUUID()),
      label: String(tag.label || '').trim(),
      color: String(tag.color || '#5f8df5'),
      locked: Boolean(tag.locked),
    }));

  const hasSteady = normalized.some((tag) => tag.label.toLowerCase() === 'steady' || tag.id === DEFAULT_STEADY_TAG.id);
  if (!hasSteady) {
    normalized.unshift({ ...DEFAULT_STEADY_TAG });
  }

  return normalized.map((tag) => (
    (tag.label.toLowerCase() === 'steady' || tag.id === DEFAULT_STEADY_TAG.id)
      ? { ...tag, id: DEFAULT_STEADY_TAG.id, label: 'Steady', color: tag.color || DEFAULT_STEADY_TAG.color, locked: true }
      : tag
  ));
};

const normalizeChecklistMathRules = (rules) => {
  if (!Array.isArray(rules)) return [];

  return rules
    .filter((rule) => rule && String(rule.criterionId || '').trim() && String(rule.labelScore || '').trim())
    .map((rule) => ({
      id: String(rule.id || crypto.randomUUID()),
      criterionId: String(rule.criterionId).trim(),
      labelScore: String(rule.labelScore).trim(),
      reportsRange: String(rule.reportsRange || '').trim(),
      weightMultiplier: Number.isFinite(Number(rule.weightMultiplier)) ? Number(rule.weightMultiplier) : 1,
      tag: String(rule.tag || '').trim(),
      insight: String(rule.insight || '').trim(),
    }));
};


const loadAdminSettings = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || '{}');
    const statusWeights = PROFILE_STATUSES.reduce((acc, status) => {
      acc[status] = Number(parsed?.statusWeights?.[status] || 0);
      return acc;
    }, {});

    const jobTypes = Array.isArray(parsed?.jobTypes)
      ? [...new Set(parsed.jobTypes.map((item) => String(item || '').trim()).filter(Boolean))]
      : [...DEFAULT_JOB_TYPES];


    return {
      statusWeights,
      jobTypes: jobTypes.length ? jobTypes : [...DEFAULT_JOB_TYPES],
      checklistMathRules: normalizeChecklistMathRules(parsed?.checklistMathRules),
      customTags: normalizeCustomTags(parsed?.customTags),
    };
  } catch {
    return {
      statusWeights: PROFILE_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {}),
      jobTypes: [...DEFAULT_JOB_TYPES],
      checklistMathRules: [],
      customTags: normalizeCustomTags([]),
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
    weights: {
      '-5': -5,
      '-2.5': -2.5,
      '0': 0,
      '2.5': 2.5,
      '5': 5,
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
    weights: {
      '-5': -5,
      '-2.5': -2.5,
      '0': 0,
      '2.5': 2.5,
      '5': 5,
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
        const weights = item.weights || {};
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
          weights: {
            '-5': Number.isFinite(Number(weights['-5'])) ? Number(weights['-5']) : -5,
            '-2.5': Number.isFinite(Number(weights['-2.5'])) ? Number(weights['-2.5']) : -2.5,
            '0': Number.isFinite(Number(weights['0'])) ? Number(weights['0']) : 0,
            '2.5': Number.isFinite(Number(weights['2.5'])) ? Number(weights['2.5']) : 2.5,
            '5': Number.isFinite(Number(weights['5'])) ? Number(weights['5']) : 5,
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

const summarizeJobTypeScores = (ratings) => {
  const byJobType = ratings.reduce((summary, entry) => {
    const jobType = String(entry.category || '').trim();
    if (!jobType) return summary;

    if (!summary[jobType]) {
      summary[jobType] = { jobType, total: 0, reviews: 0, lastRatedAt: '' };
    }

    summary[jobType].total += Number(entry.score || 0);
    summary[jobType].reviews += 1;

    const ratedAt = String(entry.ratedAt || '');
    if (!summary[jobType].lastRatedAt || new Date(ratedAt).getTime() > new Date(summary[jobType].lastRatedAt).getTime()) {
      summary[jobType].lastRatedAt = ratedAt;
    }

    return summary;
  }, {});

  return Object.values(byJobType)
    .map((entry) => ({
      ...entry,
      average: Number((entry.total / entry.reviews).toFixed(2)),
    }))
    .sort((a, b) => b.average - a.average || b.reviews - a.reviews || a.jobType.localeCompare(b.jobType));
};
const deriveStrengthTags = (ratings) => {
  const ranked = summarizeJobTypeScores(ratings).slice(0, 3);
  if (ratings.length < 2 || !ranked.length) return ['Not enough history yet.'];
  return ranked.map((entry) => `${entry.jobType} (${entry.average})`);
};

const deriveTrendFlags = (ratings) => {
  const flags = [];

  const checklistEntries = ratings.flatMap((entry) => {
    const note = String(entry.note || '');
    const matches = note.match(/([^;|]+)=([^;|]+)\(base:([-\d.]+),\s*weight:([-\d.]+)\)/gi) || [];
    return matches.map((segment) => {
      const parsed = segment.match(/([^=]+)=([^\(]+)\(base:([-\d.]+),\s*weight:([-\d.]+)\)/i);
      return {
        criterion: String(parsed?.[1] || '').trim().toLowerCase(),
        baseScore: Number(parsed?.[3] || Number.NaN),
      };
    });
  });

  const punctualityLowCount = ratings.filter((entry) => isPunctualityCategory(entry.category) && Number(entry.score) <= 0).length
    + checklistEntries.filter((entry) => isPunctualityCategory(entry.criterion) && Number(entry.baseScore) <= 0).length;
  if (punctualityLowCount >= 3) {
    flags.push('Late Trend');
  }

  const professionalismIssueCount = checklistEntries
    .filter((entry) => entry.criterion.includes('professional') && Number(entry.baseScore) <= -2.5).length;
  if (professionalismIssueCount >= 2) {
    flags.push('Professionalism Issue');
  }

  const hasNcnsRisk = ratings.some((entry) => {
    const note = String(entry.note || '').toLowerCase();
    return note.includes('ncns') || note.includes('no call');
  });
  if (hasNcnsRisk) {
    flags.push('NCNS Risk');
  }

  return flags.length ? flags : ['No active trend flags.'];
};



const renderProfileNotesTimeline = (profileId, profileNotes) => {
  if (!profileNotes?.length) {
    return '<p class="hint">No timed profile notes saved yet.</p>';
  }

  const rows = profileNotes
    .map((entry) => `<li class="entry-row"><span><strong>${formatTimestamp(entry.createdAt)}:</strong> ${entry.note}</span><button type="button" class="secondary" data-delete-note-id="${entry.id}" data-profile-id="${profileId}">Remove</button></li>`)
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


const renderExactRatings = (profileId, ratings) => {
  if (!ratings?.length) {
    return '<p class="hint">No ratings saved yet.</p>';
  }

  const rows = [...ratings]
    .sort((a, b) => new Date(b.ratedAt).getTime() - new Date(a.ratedAt).getTime())
    .map((entry) => {
      const date = formatTimestamp(entry.ratedAt);
      const note = entry.note ? `<p class="hint">${entry.note}</p>` : '';
      return `<li class="entry-row"><div><strong>${date}</strong> — ${entry.category}: ${entry.score}${note}</div><button type="button" class="secondary" data-delete-rating-id="${entry.id}" data-profile-id="${profileId}">Remove</button></li>`;
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
    const { rankScore, statusWeight } = computeRankScore(profile);

    item.innerHTML = `
      <strong>${profile.name}</strong>
      <div class="meta">
        <span>Status: ${profile.profileStatus || '—'}</span>
        <span>Categories: ${profile.jobCategories.join(', ') || '—'}</span>
        <span>Ratings: ${profile.ratings.length}</span>
        <span>Avg score (0-5): ${profile.overallScore}</span>
        <span>Rank score: ${rankScore}</span>
        <span>Status weight: ${statusWeight}</span>
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

const renderWorkerNameOptions = (profiles) => {
  if (!workerNameSelect) return;

  const previous = workerNameSelect.value;
  const sortedProfiles = [...profiles].sort((a, b) => a.name.localeCompare(b.name));

  workerNameSelect.innerHTML = '';

  if (!sortedProfiles.length) {
    workerNameSelect.innerHTML = '<option value="">No workers yet — add a profile first</option>';
    workerNameSelect.disabled = true;
    return;
  }

  workerNameSelect.disabled = false;
  workerNameSelect.innerHTML = '<option value="">Select a worker</option>';

  sortedProfiles.forEach((profile) => {
    const option = document.createElement('option');
    option.value = profile.name;
    option.textContent = profile.name;
    workerNameSelect.appendChild(option);
  });

  if (previous && sortedProfiles.some((profile) => profile.name === previous)) {
    workerNameSelect.value = previous;
  }
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

  const ratings = Array.isArray(profile.ratings) ? profile.ratings : [];
  const jobTypeSummary = summarizeJobTypeScores(ratings);
  const topJobTypes = jobTypeSummary.slice(0, 3);
  const totalReviews = ratings.length;
  const overallScore = Number(profile.overallScore || 0).toFixed(2);
  const analytics = profile.analytics || computeProfileAnalytics(ratings);

  const topJobTypeText = topJobTypes.length
    ? topJobTypes.map((entry) => `${entry.jobType} (${entry.average})`).join(' · ')
    : 'No job types rated yet';

  const scoreRows = jobTypeSummary.length
    ? jobTypeSummary
        .map((entry) => {
          const lastRated = entry.lastRatedAt ? formatTimestamp(entry.lastRatedAt) : '—';
          return `
            <tr>
              <td>${entry.jobType}</td>
              <td>${entry.average}</td>
              <td>${entry.reviews}</td>
              <td>${lastRated}</td>
            </tr>
          `;
        })
        .join('')
    : '<tr><td colspan="4">No job type scores yet.</td></tr>';

  const badgeClass = ratings.length ? statusFromScore(profile.overallScore) : 'steady';
  const badgeLabel = ratings.length ? statusLabelFromClass(badgeClass) : 'Unrated';
  workerProfileDetail.innerHTML = `
    <div class="profile-detail-header">
      <h3>${profile.name}</h3>
      <div class="profile-score-cards">
        <article class="profile-score-card">
          <p class="hint">Overall rating (0-5)</p>
          <strong>${overallScore}</strong>
        </article>
        <article class="profile-score-card">
          <p class="hint">Jobs done (reviews)</p>
          <strong>${totalReviews}</strong>
        </article>
        <article class="profile-score-card">
          <p class="hint">Top job types</p>
          <strong>${topJobTypeText}</strong>
        </article>
      </div>
      <div class="meta">
        <span>Status: ${profile.profileStatus || '—'}</span>
        <span>Consistency: ${Number(analytics.consistencyScore || 0).toFixed(1)}%</span>
        <span>Positive streak: ${analytics.currentPositiveStreak || 0}</span>
        <span>${analytics.lateTrend || 'No punctuality trend yet'}</span>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
    </div>

    <article class="category-history">
      <h4>Job type scores</h4>
      <table class="job-score-table">
        <thead>
          <tr>
            <th>Job type</th>
            <th>Avg score</th>
            <th>Reviews</th>
            <th>Last rated</th>
          </tr>
        </thead>
        <tbody>${scoreRows}</tbody>
      </table>
    </article>

    <details class="category-history">
      <summary><strong>Full job rating details</strong></summary>
      ${renderExactRatings(profile.id, ratings)}
    </details>
  `;
};

const renderJobTypeOptions = () => {
  if (!jobTypeSelect) return;

  const previous = jobTypeSelect.value;
  jobTypeSelect.innerHTML = '<option value="">Select a job type</option>';

  (adminSettings.jobTypes || []).forEach((jobType) => {
    const option = document.createElement('option');
    option.value = jobType;
    option.textContent = jobType;
    jobTypeSelect.appendChild(option);
  });

  if (previous && (adminSettings.jobTypes || []).includes(previous)) {
    jobTypeSelect.value = previous;
  }
};

const getCriterionLabelChoices = (criterionId) => {
  const criterion = ratingCriteria.find((item) => item.id === criterionId);
  if (!criterion) return [];

  return SCORE_CHOICES.map((score) => ({
    scoreKey: String(score),
    display: criterion.labels[String(score)] || String(score),
  }));
};

const renderChecklistMathBuilderOptions = () => {
  if (!mathMainCriterionSelect || !mathLabelSelect) return;

  const previousCriterionId = mathMainCriterionSelect.value;
  mathMainCriterionSelect.innerHTML = '';

  if (!ratingCriteria.length) {
    mathMainCriterionSelect.innerHTML = '<option value="">Add a checklist item first</option>';
    mathLabelSelect.innerHTML = '<option value="">No labels available</option>';
    return;
  }

  ratingCriteria.forEach((criterion) => {
    const option = document.createElement('option');
    option.value = criterion.id;
    option.textContent = criterion.name;
    mathMainCriterionSelect.appendChild(option);
  });

  mathMainCriterionSelect.value = ratingCriteria.some((criterion) => criterion.id === previousCriterionId)
    ? previousCriterionId
    : ratingCriteria[0].id;

  const labelChoices = getCriterionLabelChoices(mathMainCriterionSelect.value);
  const previousLabelScore = mathLabelSelect.value;
  mathLabelSelect.innerHTML = '';

  labelChoices.forEach((choice) => {
    const option = document.createElement('option');
    option.value = choice.scoreKey;
    option.textContent = choice.display;
    mathLabelSelect.appendChild(option);
  });

  if (labelChoices.some((choice) => choice.scoreKey === previousLabelScore)) {
    mathLabelSelect.value = previousLabelScore;
  }
};

const renderChecklistMathRules = () => {
  if (!checklistMathRulesList) return;

  checklistMathRulesList.innerHTML = '';
  const rules = normalizeChecklistMathRules(adminSettings.checklistMathRules);

  if (!rules.length) {
    checklistMathRulesList.innerHTML = '<p class="hint">No checklist math rules yet.</p>';
    return;
  }

  rules.forEach((rule) => {
    const criterion = ratingCriteria.find((item) => item.id === rule.criterionId);
    const criterionName = criterion?.name || 'Unknown checklist item';
    const labelText = criterion?.labels?.[rule.labelScore] || rule.labelScore;
    const rangeText = rule.reportsRange || 'Any count';
    const tags = normalizeCustomTags(adminSettings.customTags);
    const matchingTag = tags.find((tag) => tag.label === rule.tag);
    const tagText = rule.tag ? ` | Tag: <span class="badge custom-tag-preview" style="background:${matchingTag?.color || '#eef1fb'}; color:#1f2330;">${rule.tag}</span>` : '';
    const insightText = rule.insight ? ` | Insight: ${rule.insight}` : '';

    const row = document.createElement('div');
    row.className = 'problem-row';
    row.innerHTML = `
      <span><strong>${criterionName}</strong> → ${labelText} | Reports: ${rangeText} | Weight x${rule.weightMultiplier}${tagText}${insightText}</span>
      <button type="button" class="secondary" data-delete-checklist-math-rule="${rule.id}">Delete</button>
    `;
    checklistMathRulesList.appendChild(row);
  });
};

const renderCustomTagOptions = () => {
  if (!mathTagInput) return;
  const previous = mathTagInput.value;
  const tags = normalizeCustomTags(adminSettings.customTags);
  mathTagInput.innerHTML = '<option value="">None</option>';
  tags.forEach((tag) => {
    const option = document.createElement('option');
    option.value = tag.label;
    option.textContent = tag.label;
    mathTagInput.appendChild(option);
  });
  if ([...mathTagInput.options].some((option) => option.value === previous)) {
    mathTagInput.value = previous;
  }
};

const renderCustomTags = () => {
  if (!customTagsList) return;
  const tags = normalizeCustomTags(adminSettings.customTags);
  customTagsList.innerHTML = '';

  tags.forEach((tag) => {
    const row = document.createElement('div');
    row.className = 'problem-row';
    row.innerHTML = `
      <span><span class="badge custom-tag-preview" style="background:${tag.color}; color:#1f2330;">${tag.label}</span>${tag.locked ? ' (default)' : ''}</span>
      ${tag.locked ? '<span class="hint">Locked</span>' : `<button type="button" class="secondary" data-delete-custom-tag="${tag.id}">Delete</button>`}
    `;
    customTagsList.appendChild(row);
  });
};

const renderAdminSettings = () => {
  if (!statusWeightsContainer || !jobTypesList) return;

  statusWeightsContainer.innerHTML = PROFILE_STATUSES.map((status) => `
    <label>
      <span class="label-text">${status}</span>
      <input type="number" step="0.1" data-status-weight="${status}" value="${Number(adminSettings.statusWeights?.[status] || 0)}" />
    </label>
  `).join('');

  jobTypesList.innerHTML = '';

  if (!(adminSettings.jobTypes || []).length) {
    jobTypesList.innerHTML = '<p class="hint">No job types yet.</p>';
  }

  (adminSettings.jobTypes || []).forEach((jobType) => {
    const row = document.createElement('div');
    row.className = 'problem-row';
    row.innerHTML = `
      <span><strong>${jobType}</strong></span>
      <button type="button" class="secondary" data-delete-job-type="${jobType}">Delete</button>
    `;
    jobTypesList.appendChild(row);
  });

  renderCustomTagOptions();
  renderCustomTags();
  renderChecklistMathBuilderOptions();
  renderChecklistMathRules();
  renderJobTypeOptions();
};

const syncStatusWeightsFromInputs = () => {
  PROFILE_STATUSES.forEach((status) => {
    const field = statusWeightsContainer?.querySelector(`[data-status-weight="${status}"]`);
    adminSettings.statusWeights[status] = Number(field?.value || 0);
  });
};

const persistAdminSettings = ({ rerenderAdmin = false } = {}) => {
  saveAdminSettings();
  if (rerenderAdmin) {
    renderAdminSettings();
  }
  renderAll(profilesCache);
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
      <span><strong>${criterion.name}</strong> — ${criterion.labels['-5']} (w:${criterion.weights?.['-5'] ?? -5}) | ${criterion.labels['-2.5']} (w:${criterion.weights?.['-2.5'] ?? -2.5}) | ${criterion.labels['0']} (w:${criterion.weights?.['0'] ?? 0}) | ${criterion.labels['2.5']} (w:${criterion.weights?.['2.5'] ?? 2.5}) | ${criterion.labels['5']} (w:${criterion.weights?.['5'] ?? 5})</span>
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
        ${SCORE_CHOICES.map((value) => `<label><input type="radio" name="criterion-${criterion.id}" value="${value}" ${value === 0 ? 'checked' : ''} /> <span>${criterion.labels[String(value)]} (w:${criterion.weights?.[String(value)] ?? value})</span></label>`).join('')}
      </div>
    `;
    criteriaRatingsContainer.appendChild(row);
  });
};

const renderAll = (profiles) => {
  renderProfiles(profiles);
  renderWorkerSelector(profiles);
  renderWorkerNameOptions(profiles);
  renderWorkerProfile(profiles, workerSelector.value);
  renderJobTypeOptions();
  renderCriterionRatings();
  renderRatingCriteriaRows();
  renderCustomTagOptions();
  renderCustomTags();
  renderChecklistMathBuilderOptions();
  renderChecklistMathRules();
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
    return;
  }

  rulesList.innerHTML = '';

  if (!ratingRules.length) {
    rulesList.innerHTML = '<li class="profile-item">No rating rules yet. Add one like “Full-time → Was late = -3”.</li>';
    renderRuleSelect();
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

const setQuickWorkerFeedback = (message, isError = false) => {
  if (!quickWorkerFeedback) return;
  quickWorkerFeedback.textContent = message;
  quickWorkerFeedback.classList.toggle('field-error', isError);
};

const quickAddWorkerByName = async () => {
  if (!quickWorkerNameInput) return;

  const workerName = quickWorkerNameInput.value.trim();
  if (workerName.length < 2) {
    setQuickWorkerFeedback('Worker name must be at least 2 characters.', true);
    return;
  }

  const existing = profilesCache.find((profile) => String(profile.name || '').trim().toLowerCase() === workerName.toLowerCase());
  if (existing) {
    workerNameSelect.value = existing.name;
    setQuickWorkerFeedback('Worker already exists. Selected existing profile.');
    return;
  }

  try {
    const savedProfile = await addProfile({
      name: workerName,
      status: '',
      background: '',
      historyEntries: [],
      profileNotes: [],
    });

    await refreshFromBackend();

    const matched = profilesCache.find((profile) => String(profile.id) === String(savedProfile.id))
      || profilesCache.find((profile) => String(profile.name || '').trim().toLowerCase() === workerName.toLowerCase());

    if (matched) {
      workerNameSelect.value = matched.name;
    }

    quickWorkerNameInput.value = '';
    setQuickWorkerFeedback(`Added worker "${workerName}".`);
  } catch (error) {
    setQuickWorkerFeedback(error.message || 'Unable to add worker right now.', true);
  }
};


const setAdminFeedback = (message, isError = false) => {
  if (!adminAccessFeedback) return;
  adminAccessFeedback.textContent = message;
  adminAccessFeedback.classList.toggle('field-error', isError);
};

const getAdminPassword = () => localStorage.getItem(ADMIN_ACCESS_PASSWORD_KEY) || DEFAULT_ADMIN_ACCESS_PASSWORD;

const setAdminUnlocked = (unlocked) => {
  adminAccessUnlocked = unlocked;
  if (unlocked) {
    localStorage.setItem(ADMIN_ACCESS_SESSION_KEY, 'unlocked');
  } else {
    localStorage.removeItem(ADMIN_ACCESS_SESSION_KEY);
  }
};

const canAccessAdmin = () => {
  const configuredPassword = getAdminPassword();
  if (!configuredPassword) {
    setAdminUnlocked(true);
    return true;
  }

  if (adminAccessUnlocked) return true;

  const attempt = window.prompt('Enter admin password to access settings:', '');
  if (attempt === null) return false;
  if (attempt === configuredPassword) {
    setAdminUnlocked(true);
    return true;
  }

  // eslint-disable-next-line no-alert
  alert('Incorrect admin password.');
  return false;
};

const lockAdminAccess = () => {
  setAdminUnlocked(false);
  setAdminFeedback('Admin area locked.');
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
  if (show && !canAccessAdmin()) {
    return;
  }

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


const setupAdminSectionToggles = () => {
  document.querySelectorAll('#admin-settings-form .admin-section').forEach((section, index) => {
    const legend = section.querySelector('legend');
    if (!legend || legend.querySelector('[data-admin-section-toggle]')) return;

    section.classList.add('is-open');
    section.setAttribute('data-admin-section-index', String(index + 1));

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-section-toggle';
    toggle.setAttribute('data-admin-section-toggle', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.textContent = 'Collapse';

    toggle.addEventListener('click', () => {
      const isOpen = section.classList.toggle('is-open');
      section.classList.toggle('is-collapsed', !isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.textContent = isOpen ? 'Collapse' : 'Expand';
    });

    legend.appendChild(toggle);
  });
};

const buildRatingPayload = (data) => {
  const noteText = data.get('note').toString().trim();
  const selectedCriteria = ratingCriteria
    .filter((criterion) => {
      const toggle = form.querySelector(`[data-criterion-toggle="${criterion.id}"]`);
      return toggle?.checked;
    })
    .map((criterion) => {
      const scoreField = form.querySelector(`input[name="criterion-${criterion.id}"]:checked`);
      const score = Number(scoreField?.value ?? 0);
      const label = criterion.labels[String(score)] || '';
      const weightedScore = Number(criterion.weights?.[String(score)] ?? score);
      return { criterion: criterion.name, score, weightedScore, label };
    });

  const checklistAverage = selectedCriteria.length
    ? Number((selectedCriteria.reduce((total, entry) => total + entry.weightedScore, 0) / selectedCriteria.length).toFixed(2))
    : null;

  const note = [
    selectedCriteria.length ? `Checklist: ${selectedCriteria.map((entry) => `${entry.criterion}=${entry.label} (base:${entry.score}, weight:${entry.weightedScore})`).join('; ')}` : '',
    noteText,
  ].filter(Boolean).join(' | ');

  const jobType = data.get('jobType').toString().trim();

  return {
    workerName: data.get('workerName').toString().trim(),
    category: jobType,
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
    renderCriterionRatings();
    renderJobTypeOptions();
  } catch (error) {
    // eslint-disable-next-line no-alert
    alert(error.message);
  }
});

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


if (addJobTypeButton) {
  addJobTypeButton.addEventListener('click', () => {
    const nameField = document.getElementById('job-type-name');
    const name = nameField.value.trim();
    if (!name) return;
    if ((adminSettings.jobTypes || []).some((jobType) => jobType.toLowerCase() == name.toLowerCase())) return;

    adminSettings.jobTypes.push(name);
    nameField.value = '';
    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (jobTypesList) {
  jobTypesList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const jobType = target.getAttribute('data-delete-job-type');
    if (!jobType) return;

    adminSettings.jobTypes = (adminSettings.jobTypes || []).filter((entry) => entry !== jobType);
    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (saveAdminPasswordButton) {
  saveAdminPasswordButton.addEventListener('click', () => {
    const password = String(adminPasswordInput?.value || '').trim();
    if (!password) {
      setAdminFeedback('Enter a password before saving.', true);
      return;
    }

    localStorage.setItem(ADMIN_ACCESS_PASSWORD_KEY, password);
    if (adminPasswordInput) adminPasswordInput.value = '';
    setAdminUnlocked(true);
    setAdminFeedback('Admin password saved. Access is now protected.');
  });
}

if (lockAdminButton) {
  lockAdminButton.addEventListener('click', () => {
    lockAdminAccess();
    showAdminPage(false);
  });
}

if (statusWeightsContainer) {
  statusWeightsContainer.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.hasAttribute('data-status-weight')) return;

    syncStatusWeightsFromInputs();
    persistAdminSettings();
  });
}


if (adminSettingsForm) {
  adminSettingsForm.addEventListener('submit', (event) => {
    event.preventDefault();

    syncStatusWeightsFromInputs();
    persistAdminSettings({ rerenderAdmin: true });
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
    const veryBadWeight = Number(document.getElementById('criterion-weight-very-bad').value);
    const littleBadWeight = Number(document.getElementById('criterion-weight-little-bad').value);
    const neutralWeight = Number(document.getElementById('criterion-weight-neutral').value);
    const littleGoodWeight = Number(document.getElementById('criterion-weight-little-good').value);
    const veryGoodWeight = Number(document.getElementById('criterion-weight-very-good').value);

    if (!name) return;
    if ([veryBadWeight, littleBadWeight, neutralWeight, littleGoodWeight, veryGoodWeight].some((value) => Number.isNaN(value))) return;

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
      weights: {
        '-5': veryBadWeight,
        '-2.5': littleBadWeight,
        '0': neutralWeight,
        '2.5': littleGoodWeight,
        '5': veryGoodWeight,
      },
    });

    ['criterion-name', 'criterion-very-bad', 'criterion-little-bad', 'criterion-neutral', 'criterion-little-good', 'criterion-very-good'].forEach((fieldId) => {
      document.getElementById(fieldId).value = '';
    });
    document.getElementById('criterion-weight-very-bad').value = '-5';
    document.getElementById('criterion-weight-little-bad').value = '-2.5';
    document.getElementById('criterion-weight-neutral').value = '0';
    document.getElementById('criterion-weight-little-good').value = '2.5';
    document.getElementById('criterion-weight-very-good').value = '5';

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


if (addCustomTagButton) {
  addCustomTagButton.addEventListener('click', () => {
    const label = String(customTagNameInput?.value || '').trim();
    const color = String(customTagColorInput?.value || '#5f8df5').trim();
    if (!label) return;

    const tags = normalizeCustomTags(adminSettings.customTags);
    if (tags.some((tag) => tag.label.toLowerCase() === label.toLowerCase())) return;

    adminSettings.customTags = [
      ...tags,
      { id: crypto.randomUUID(), label, color, locked: false },
    ];

    if (customTagNameInput) customTagNameInput.value = '';
    if (customTagColorInput) customTagColorInput.value = '#5f8df5';
    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (customTagsList) {
  customTagsList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tagId = target.getAttribute('data-delete-custom-tag');
    if (!tagId) return;

    adminSettings.customTags = normalizeCustomTags(adminSettings.customTags)
      .filter((tag) => tag.id !== tagId || tag.locked);
    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (mathMainCriterionSelect) {
  mathMainCriterionSelect.addEventListener('change', () => {
    const labelChoices = getCriterionLabelChoices(mathMainCriterionSelect.value);
    const previousLabelScore = mathLabelSelect?.value || '';
    if (!mathLabelSelect) return;

    mathLabelSelect.innerHTML = '';
    labelChoices.forEach((choice) => {
      const option = document.createElement('option');
      option.value = choice.scoreKey;
      option.textContent = choice.display;
      mathLabelSelect.appendChild(option);
    });

    if (labelChoices.some((choice) => choice.scoreKey === previousLabelScore)) {
      mathLabelSelect.value = previousLabelScore;
    }
  });
}

if (addChecklistMathRuleButton) {
  addChecklistMathRuleButton.addEventListener('click', () => {
    const criterionId = String(mathMainCriterionSelect?.value || '').trim();
    const labelScore = String(mathLabelSelect?.value || '').trim();
    const reportsRange = String(mathReportRangeInput?.value || '').trim();
    const weightMultiplier = Number(mathWeightMultiplierInput?.value || 1);
    const tag = String(mathTagInput?.value || '').trim();
    const insight = String(mathInsightInput?.value || '').trim();

    if (!criterionId || !labelScore) return;
    if (!Number.isFinite(weightMultiplier) || weightMultiplier < 0) return;

    adminSettings.checklistMathRules = [
      ...normalizeChecklistMathRules(adminSettings.checklistMathRules),
      {
        id: crypto.randomUUID(),
        criterionId,
        labelScore,
        reportsRange,
        weightMultiplier,
        tag,
        insight,
      },
    ];

    if (mathReportRangeInput) mathReportRangeInput.value = '';
    if (mathWeightMultiplierInput) mathWeightMultiplierInput.value = '1';
    if (mathTagInput) mathTagInput.value = '';
    if (mathInsightInput) mathInsightInput.value = '';

    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (checklistMathRulesList) {
  checklistMathRulesList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const ruleId = target.getAttribute('data-delete-checklist-math-rule');
    if (!ruleId) return;

    adminSettings.checklistMathRules = normalizeChecklistMathRules(adminSettings.checklistMathRules)
      .filter((rule) => rule.id !== ruleId);
    persistAdminSettings({ rerenderAdmin: true });
  });
}


if (workerProfileDetail) {
  workerProfileDetail.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const profileId = target.getAttribute('data-profile-id');
    if (!profileId) return;

    const ratingId = target.getAttribute('data-delete-rating-id');
    if (ratingId) {
      try {
        await deleteProfileRating(profileId, ratingId);
        await refreshFromBackend();
        workerSelector.value = String(profileId);
        renderWorkerProfile(profilesCache, profileId);
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(error.message || 'Unable to delete rating');
      }
      return;
    }

    const noteId = target.getAttribute('data-delete-note-id');
    if (noteId) {
      try {
        await deleteProfileNote(profileId, noteId);
        await refreshFromBackend();
        workerSelector.value = String(profileId);
        renderWorkerProfile(profilesCache, profileId);
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(error.message || 'Unable to delete note');
      }
    }
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

if (quickAddWorkerButton) {
  quickAddWorkerButton.addEventListener('click', async () => {
    await quickAddWorkerByName();
  });
}

if (quickWorkerNameInput) {
  quickWorkerNameInput.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await quickAddWorkerByName();
  });
}

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

if (!localStorage.getItem(ADMIN_ACCESS_PASSWORD_KEY)) {
  localStorage.setItem(ADMIN_ACCESS_PASSWORD_KEY, DEFAULT_ADMIN_ACCESS_PASSWORD);
}

adminSettings = loadAdminSettings();
ratingRules = loadRatingRules();
ratingCriteria = loadRatingCriteria();
initializeStatusOptions();
renderRules();
renderAdminSettings();
setupAdminSectionToggles();
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

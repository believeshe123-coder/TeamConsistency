const API_BASE = '/api';
const RATING_CATEGORIES = ['Punctuality', 'Skill', 'Teamwork'];
const PROFILE_STATUSES = [];
const RATING_RULES_KEY = 'worker-rating-rules-v1';
const ADMIN_SETTINGS_KEY = 'worker-admin-settings-v1';
const RATING_CRITERIA_KEY = 'worker-rating-criteria-v1';
const SCORE_CHOICES = [-5, -2.5, 0, 2.5, 5];
const ADMIN_ACCESS_PASSWORD_KEY = 'worker-admin-access-password-v1';
const DEFAULT_ADMIN_ACCESS_PASSWORD = '1234';
const RECENT_TAG_COLORS_KEY = 'worker-recent-tag-colors-v1';
const CHANGE_LOG_KEY = 'worker-change-log-v1';
const CHANGE_LOG_LIMIT = 80;

const form = document.getElementById('rating-form');
const addProfileForm = document.getElementById('add-profile-form');
const addProfileButton = document.getElementById('add-profile');
const cancelAddProfileButton = document.getElementById('cancel-add-profile');
const addHistoryEntryButton = document.getElementById('add-history-entry');
const addNoteEntryButton = document.getElementById('add-note-entry');
const profileHistoryList = document.getElementById('profile-history-list');
const profileNotesList = document.getElementById('profile-notes-list');
const profilesList = document.getElementById('profiles');
const topPerformersList = document.getElementById('top-performers');
const clearButton = document.getElementById('clear-data');
const refreshProfilesButton = document.getElementById('refresh-profiles');
const dataSyncStatus = document.getElementById('data-sync-status');
const jobTypeSelect = document.getElementById('job-type');
const workerSelector = document.getElementById('worker-selector');
const workerProfileDetail = document.getElementById('worker-profile-detail');
const rulesForm = document.getElementById('rating-rules-form');
const rulesList = document.getElementById('rating-rules-list');
const ruleSelect = document.getElementById('rating-rule-select');
const mainPage = document.getElementById('main-page');
const ratingsPage = document.getElementById('ratings-page');
const profilePage = document.getElementById('profile-page');
const adminPage = document.getElementById('admin-page');
const tabProfiles = document.getElementById('tab-profiles');
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
const customTagRecentColors = document.getElementById('custom-tag-recent-colors');
const addCustomTagButton = document.getElementById('add-custom-tag');
const mathInsightInput = document.getElementById('math-insight');
const addChecklistMathRuleButton = document.getElementById('add-checklist-math-rule');
const addJobTypePanel = document.getElementById('add-job-type-panel');
const addRatingCriterionPanel = document.getElementById('add-rating-criterion-panel');
const addChecklistMathRulePanel = document.getElementById('add-checklist-math-rule-panel');
const addCustomTagPanel = document.getElementById('add-custom-tag-panel');
const workerNameSelect = document.getElementById('workerName');
const quickAddWorkerButton = document.getElementById('quick-add-worker');
const quickWorkerNameInput = document.getElementById('quick-worker-name');
const quickWorkerFeedback = document.getElementById('quick-worker-feedback');
const refreshMaintenanceReportButton = document.getElementById('refresh-maintenance-report');
const maintenanceReport = document.getElementById('maintenance-report');
const adminReviewLog = document.getElementById('admin-review-log');
const adminProfileDeleteList = document.getElementById('admin-profile-delete-list');
const adminLogUndoButton = document.getElementById('admin-log-undo');
const adminLogRedoButton = document.getElementById('admin-log-redo');
const downloadBrowserBackupButton = document.getElementById('download-browser-backup');
const restoreBrowserBackupInput = document.getElementById('restore-browser-backup');
const profileSearchInput = document.getElementById('profile-search');
const workerSearchNameInput = document.getElementById('worker-search-name');
const workerSearchModeSelect = document.getElementById('worker-search-mode');
const workerSearchJobTypeSelect = document.getElementById('worker-search-job-type');
const workerSearchCriterionSelect = document.getElementById('worker-search-criterion');
const workerSearchResetButton = document.getElementById('worker-search-reset');
const workerSearchResults = document.getElementById('worker-search-results');

let profilesCache = [];
let ratingRules = [];
let adminSettings = { statusWeights: {}, jobTypes: [], checklistMathRules: [], customTags: [] };
let ratingCriteria = [];
let adminAccessUnlocked = false;
let editingProfileId = null;
let editingJobTypeName = null;
let editingCriterionId = null;
let editingCustomTagId = null;
let editingChecklistMathRuleId = null;
let changeLogEntries = [];
let changeLogCursor = -1;
let isApplyingChangeLogState = false;

const LOCAL_PROFILES_KEY = 'worker-profiles-local-v1';

const formatTimestamp = (value) => new Date(value).toLocaleString();
const nowIso = () => new Date().toISOString();
const normalizeNameKey = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const normalizeEmployeeId = (value) => String(value || '').trim().replace(/\s+/g, '').toLowerCase();
const canonicalWorkerKey = (name, employeeId = '') => {
  const n = normalizeNameKey(name);
  const eid = normalizeEmployeeId(employeeId);
  return eid ? `${n}::${eid}` : n;
};
const confirmAction = (message = 'Do you really want to clear?') => window.confirm(message);
const AUTO_SYNC_INTERVAL_MS = 60000;
const ADMIN_SYNC_KEY = 'settings_bundle_v1';

const DEFAULT_STEADY_TAG = { id: 'steady-default', label: 'Solid', color: '#5f8df5', locked: true };

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

const toTenPointScale = (score) => Number((clamp(Number(score) || 0, 0, 5) * 2).toFixed(1));
const performanceTierLabel = (tenPointScore) => {
  if (tenPointScore >= 9) return 'Elite';
  if (tenPointScore >= 7) return 'Reliable';
  if (tenPointScore >= 5) return 'Solid';
  if (tenPointScore >= 4) return 'Needs support';
  return 'Critical risk';
};

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
    externalEmployeeId: incomingProfile.externalEmployeeId || previous?.externalEmployeeId || '',
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
  const tenPointScore = toTenPointScale(score);
  if (tenPointScore >= 6) return 'top-performer';
  if (tenPointScore <= 4) return 'at-risk';
  return 'steady';
};


const computeRankScore = (profile) => {
  const consistencyScore = Number(profile.analytics?.consistencyScore || 0);
  const consistencyBuff = Number((Math.max(0, (consistencyScore - 50) / 50) * 1.5).toFixed(2));
  const rankScore = Number((Number(profile.overallScore || 0) + consistencyBuff).toFixed(2));
  return { rankScore, consistencyBuff };
};

const computeJobsCount = (profile) => Array.isArray(profile?.ratings) ? profile.ratings.length : 0;

const statusLabelFromClass = (badgeClass) => {
  if (badgeClass === 'top-performer') return 'Reliable';
  if (badgeClass === 'at-risk') return 'Needs support';
  if (badgeClass === 'steady') return 'Solid';
  return 'Unrated';
};


const hasWorkerApi = () => Boolean(window.workerApi);

const flagsFromNote = (note) => {
  const normalized = String(note || '').toLowerCase();
  return {
    late: normalized.includes('late'),
    ncns: normalized.includes('ncns') || normalized.includes('no call no show') || normalized.includes('no call'),
  };
};

const toProfileFromBackend = (worker, ratings, localProfile = {}) => recalculateProfileFields({
  id: worker.id,
  name: worker.name,
  profileStatus: localProfile.profileStatus || '',
  backgroundInfo: localProfile.backgroundInfo || '',
  externalEmployeeId: localProfile.externalEmployeeId || '',
  ratings: ratings.map((entry) => ({
    id: entry.id,
    category: entry.jobCategory,
    score: Number(entry.overallScore),
    reviewer: 'Anonymous',
    note: entry.notes || '',
    ratedAt: entry.date || entry.createdAt,
  })),
  historyEntries: localProfile.historyEntries || [],
  profileNotes: localProfile.profileNotes || [],
  createdAt: localProfile.createdAt || worker.createdAt || nowIso(),
  updatedAt: nowIso(),
});

const fetchProfiles = async () => {
  if (hasWorkerApi()) {
    try {
      const workers = await window.workerApi.getWorkers();
      const localProfiles = loadLocalProfiles();
      const localByName = new Map(localProfiles.map((profile) => [normalizeNameKey(profile.name), profile]));
      const ratingsList = await Promise.all(workers.map((worker) => window.workerApi.getWorkerRatings(worker.id)));
      const profiles = workers.map((worker, index) => {
        const localProfile = localByName.get(normalizeNameKey(worker.name));
        return toProfileFromBackend(worker, ratingsList[index] || [], localProfile || {});
      });
      saveLocalProfiles(profiles);
      return profiles;
    } catch {
      // fall through to legacy API before using local-only cache
    }
  }

  try {
    const response = await fetch(`${API_BASE}/profiles`);
    if (!response.ok) throw new Error('Unable to load profiles');
    return response.json();
  } catch {
    return loadLocalProfiles();
  }
};

const saveRating = async (rating) => {
  if (hasWorkerApi()) {
    try {
      let worker = profilesCache.find((entry) => normalizeNameKey(entry.name) === normalizeNameKey(rating.workerName));
      if (!worker) {
        const created = await window.workerApi.createWorker(rating.workerName);
        worker = { id: created.id, name: created.name };
      }

      await window.workerApi.createRating({
        workerId: Number(worker.id),
        date: rating.ratedAt || nowIso(),
        jobCategory: rating.category,
        overallScore: Number(rating.score),
        flags: flagsFromNote(rating.note),
        notes: rating.note || '',
      });

      return { id: worker.id, name: worker.name || rating.workerName };
    } catch {
      // fall through to legacy API before using local-only cache
    }
  }

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
        historyEntries: [
          ...(profiles[profileIndex].historyEntries || []),
          {
            id: `local-history-${Date.now()}`,
            category: rating.category,
            score: Number(rating.score),
            note: `Rating logged by ${rating.reviewer}${rating.note ? `: ${rating.note}` : ''}`,
            createdAt: now,
          },
        ],
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
        externalEmployeeId: rating.externalEmployeeId || '',
        ratings: [ratingEntry],
        historyEntries: [{
          id: `local-history-${Date.now()}`,
          category: rating.category,
          score: Number(rating.score),
          note: `Rating logged by ${rating.reviewer}${rating.note ? `: ${rating.note}` : ''}`,
          createdAt: now,
        }],
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


const updateAdminCatalog = async () => {
  try {
    await fetch(`${API_BASE}/admin/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTypes: adminSettings.jobTypes || [], criteriaNames: ratingCriteria.map((item) => item.name) }),
    });
  } catch {
    // no-op fallback for offline mode
  }
};

const pushAdminBundleToBackend = async () => {
  try {
    await fetch(`${API_BASE}/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: ADMIN_SYNC_KEY,
        value: {
          adminSettings,
          ratingCriteria,
          ratingRules,
          recentTagColors: loadRecentTagColors(),
        },
      }),
    });
  } catch {
    // no-op fallback for offline mode
  }
};

const pullAdminBundleFromBackend = async () => {
  const response = await fetch(`${API_BASE}/admin/settings?key=${encodeURIComponent(ADMIN_SYNC_KEY)}`);
  if (!response.ok) throw new Error('Unable to load shared admin settings');
  const payload = await response.json();
  const value = payload?.value;
  if (!value || typeof value !== 'object') return false;

  adminSettings = {
    ...loadAdminSettings(),
    ...(value.adminSettings && typeof value.adminSettings === 'object' ? value.adminSettings : {}),
    checklistMathRules: normalizeChecklistMathRules(value?.adminSettings?.checklistMathRules),
    customTags: normalizeCustomTags(value?.adminSettings?.customTags),
    statusWeights: PROFILE_STATUSES.reduce((acc, status) => {
      acc[status] = Number(value?.adminSettings?.statusWeights?.[status] || 0);
      return acc;
    }, {}),
    jobTypes: Array.isArray(value?.adminSettings?.jobTypes) && value.adminSettings.jobTypes.length
      ? value.adminSettings.jobTypes.map((item) => String(item || '').trim()).filter(Boolean)
      : [...DEFAULT_JOB_TYPES],
  };

  if (Array.isArray(value.ratingCriteria) && value.ratingCriteria.length) {
    localStorage.setItem(RATING_CRITERIA_KEY, JSON.stringify(value.ratingCriteria));
    ratingCriteria = loadRatingCriteria();
  }

  if (Array.isArray(value.ratingRules)) {
    ratingRules = value.ratingRules;
    saveRatingRules();
  }

  if (Array.isArray(value.recentTagColors)) {
    localStorage.setItem(RECENT_TAG_COLORS_KEY, JSON.stringify(value.recentTagColors));
  }

  saveAdminSettings();
  return true;
};

const fetchMaintenanceReport = async () => {
  const response = await fetch(`${API_BASE}/admin/maintenance-report`);
  if (!response.ok) throw new Error('Unable to load maintenance report');
  return response.json();
};

const mergeProfiles = async (sourceProfileId, targetProfileId) => {
  const response = await fetch(`${API_BASE}/profiles/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceProfileId, targetProfileId }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Unable to merge profiles');
  }

  return response.json();
};

const findLikelyDuplicates = (name, employeeId = '', excludeId = null) => {
  const targetName = normalizeNameKey(name);
  const targetId = normalizeEmployeeId(employeeId);

  return profilesCache.filter((profile) => {
    if (excludeId !== null && String(profile.id) === String(excludeId)) return false;
    const profileName = normalizeNameKey(profile.name);
    const profileId = normalizeEmployeeId(profile.externalEmployeeId || '');
    if (targetId && profileId) return targetName === profileName || targetId === profileId;
    return targetName === profileName;
  });
};

const addProfile = async (profile) => {
  if (hasWorkerApi()) {
    try {
      const createdWorker = await window.workerApi.createWorker(profile.name);
      const localProfile = upsertLocalProfile(profile);
      const profiles = loadLocalProfiles();
      const localIndex = profiles.findIndex((entry) => normalizeNameKey(entry.name) === normalizeNameKey(createdWorker.name));
      if (localIndex >= 0) {
        profiles[localIndex] = { ...profiles[localIndex], id: createdWorker.id, name: createdWorker.name };
        saveLocalProfiles(profiles);
      }
      return {
        ...localProfile,
        id: createdWorker.id,
        name: createdWorker.name,
      };
    } catch {
      // fall through to legacy API before using local-only cache
    }
  }

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

const updateProfile = async (profileId, payload) => {
  try {
    const response = await fetch(`${API_BASE}/profiles/${profileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Unable to update profile');
    }

    return response.json();
  } catch {
    const profiles = loadLocalProfiles();
    const profileIndex = profiles.findIndex((entry) => String(entry.id) === String(profileId));
    if (profileIndex < 0) throw new Error('Profile not found');

    const current = profiles[profileIndex];
    profiles[profileIndex] = recalculateProfileFields({
      ...current,
      name: payload.name,
      profileStatus: payload.status,
      externalEmployeeId: payload.externalEmployeeId || current.externalEmployeeId || '',
      backgroundInfo: payload.background,
      historyEntries: Array.isArray(payload.historyEntries) ? payload.historyEntries : (current.historyEntries || []),
      profileNotes: Array.isArray(payload.profileNotes) ? payload.profileNotes : (current.profileNotes || []),
      updatedAt: nowIso(),
    });
    saveLocalProfiles(profiles);
    return profiles[profileIndex];
  }
};

const deleteProfile = async (profileId) => {
  try {
    const response = await fetch(`${API_BASE}/profiles/${profileId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Unable to delete profile');
  } catch {
    const profiles = loadLocalProfiles();
    saveLocalProfiles(profiles.filter((entry) => String(entry.id) !== String(profileId)));
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
      ? { ...tag, id: DEFAULT_STEADY_TAG.id, label: 'Solid', color: tag.color || DEFAULT_STEADY_TAG.color, locked: true }
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

const normalizeColorHex = (color) => {
  const value = String(color || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '#5f8df5';
};

const cleanFrontEndDisplayText = (text) => String(text || '')
  .replace(/\s*\(\d+(?:\.\d+)?\s*\/\s*10\)\s*/gi, ' ')
  .replace(/\s*\(w\s*:\s*[-\d.]+\)\s*/gi, ' ')
  .replace(/\s*\(base\s*:\s*[-\d.]+\s*,\s*weight\s*:\s*[-\d.]+\)\s*/gi, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim();


const deepClone = (value) => JSON.parse(JSON.stringify(value));

const captureStateSnapshot = () => ({
  profiles: deepClone(profilesCache || []),
  adminSettings: deepClone(adminSettings || {}),
  ratingCriteria: deepClone(ratingCriteria || []),
  ratingRules: deepClone(ratingRules || []),
});

const snapshotsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const saveChangeLog = () => {
  localStorage.setItem(CHANGE_LOG_KEY, JSON.stringify({ entries: changeLogEntries, cursor: changeLogCursor }));
};

const loadChangeLog = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHANGE_LOG_KEY) || '{}');
    changeLogEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    changeLogCursor = Number.isInteger(parsed.cursor) ? parsed.cursor : (changeLogEntries.length - 1);
    changeLogCursor = Math.max(-1, Math.min(changeLogCursor, changeLogEntries.length - 1));
  } catch {
    changeLogEntries = [];
    changeLogCursor = -1;
  }
};

const updateChangeLogButtons = () => {
  if (adminLogUndoButton) adminLogUndoButton.disabled = changeLogCursor < 0;
  if (adminLogRedoButton) adminLogRedoButton.disabled = changeLogCursor >= changeLogEntries.length - 1;
};

const recordStateChange = (label, beforeSnapshot, afterSnapshot) => {
  if (isApplyingChangeLogState) return;
  if (!beforeSnapshot || !afterSnapshot || snapshotsEqual(beforeSnapshot, afterSnapshot)) return;

  if (changeLogCursor < changeLogEntries.length - 1) {
    changeLogEntries = changeLogEntries.slice(0, changeLogCursor + 1);
  }

  const nextEntry = {
    id: crypto.randomUUID(),
    label,
    createdAt: nowIso(),
    before: beforeSnapshot,
    after: afterSnapshot,
  };

  changeLogEntries.push(nextEntry);
  if (changeLogEntries.length > CHANGE_LOG_LIMIT) {
    changeLogEntries = changeLogEntries.slice(changeLogEntries.length - CHANGE_LOG_LIMIT);
  }
  changeLogCursor = changeLogEntries.length - 1;
  saveChangeLog();
};

const applyStateSnapshot = async (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return;

  isApplyingChangeLogState = true;
  try {
    profilesCache = Array.isArray(snapshot.profiles) ? deepClone(snapshot.profiles) : [];
    adminSettings = {
      ...adminSettings,
      ...(snapshot.adminSettings || {}),
      checklistMathRules: normalizeChecklistMathRules(snapshot?.adminSettings?.checklistMathRules),
      customTags: normalizeCustomTags(snapshot?.adminSettings?.customTags),
    };
    ratingCriteria = Array.isArray(snapshot.ratingCriteria) ? deepClone(snapshot.ratingCriteria) : [];
    ratingRules = Array.isArray(snapshot.ratingRules) ? deepClone(snapshot.ratingRules) : [];

    saveLocalProfiles(profilesCache);
    localStorage.setItem(RATING_RULES_KEY, JSON.stringify(ratingRules));
    localStorage.setItem(RATING_CRITERIA_KEY, JSON.stringify(ratingCriteria));
    saveAdminSettings();

    renderRules();
    renderAdminSettings();
    renderAll(profilesCache);

    await pushAdminBundleToBackend();
  } finally {
    isApplyingChangeLogState = false;
  }
};

const undoStateChange = async () => {
  if (changeLogCursor < 0) return;
  const entry = changeLogEntries[changeLogCursor];
  if (!entry?.before) return;
  await applyStateSnapshot(entry.before);
  changeLogCursor -= 1;
  saveChangeLog();
  renderAdminReviewLog();
};

const redoStateChange = async () => {
  if (changeLogCursor >= changeLogEntries.length - 1) return;
  const entry = changeLogEntries[changeLogCursor + 1];
  if (!entry?.after) return;
  await applyStateSnapshot(entry.after);
  changeLogCursor += 1;
  saveChangeLog();
  renderAdminReviewLog();
};

const withChangeLog = async (label, operation) => {
  const beforeSnapshot = captureStateSnapshot();
  const result = await operation();
  const afterSnapshot = captureStateSnapshot();
  recordStateChange(label, beforeSnapshot, afterSnapshot);
  renderAdminReviewLog();
  return result;
};

const loadRecentTagColors = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_TAG_COLORS_KEY) || '[]');
    return Array.isArray(parsed)
      ? [...new Set(parsed.map(normalizeColorHex))].slice(0, 8)
      : [];
  } catch {
    return [];
  }
};

const saveRecentTagColor = (color) => {
  const normalized = normalizeColorHex(color);
  const updated = [
    normalized,
    ...loadRecentTagColors().filter((entry) => entry !== normalized),
  ].slice(0, 8);
  localStorage.setItem(RECENT_TAG_COLORS_KEY, JSON.stringify(updated));
  pushAdminBundleToBackend();
};

const renderRecentTagColors = () => {
  if (!customTagRecentColors) return;
  const colors = loadRecentTagColors();
  customTagRecentColors.innerHTML = '';
  if (!colors.length) {
    customTagRecentColors.innerHTML = '<span class="hint">No recent colors yet.</span>';
    return;
  }

  colors.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-color-chip';
    button.setAttribute('data-recent-tag-color', color);
    button.title = color;
    button.style.background = color;
    button.setAttribute('aria-label', `Use recent color ${color}`);
    customTagRecentColors.appendChild(button);
  });
};

const findCriterionByName = (name) => ratingCriteria.find((criterion) => criterion.name.toLowerCase() === String(name || '').trim().toLowerCase());

const resolveLabelScore = (criterion, labelOrScore) => {
  const cleaned = String(labelOrScore || '').trim();
  if (!cleaned) return '';
  if (Object.prototype.hasOwnProperty.call(criterion.labels || {}, cleaned)) return cleaned;

  const lower = cleaned.toLowerCase();
  const labelEntry = Object.entries(criterion.labels || {})
    .find(([, label]) => String(label || '').trim().toLowerCase() === lower);
  return labelEntry?.[0] || '';
};

const ensureTagExists = (label, color = '#5f8df5') => {
  const trimmed = String(label || '').trim();
  if (!trimmed) return false;

  const tags = normalizeCustomTags(adminSettings.customTags);
  if (tags.some((tag) => tag.label.toLowerCase() === trimmed.toLowerCase())) return false;

  adminSettings.customTags = [
    ...tags,
    { id: crypto.randomUUID(), label: trimmed, color: normalizeColorHex(color), locked: false },
  ];
  return true;
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
  updateAdminCatalog();
  pushAdminBundleToBackend();
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
  pushAdminBundleToBackend();
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


const computeFrequencyWeightedIndicators = (ratings) => {
  if (!ratings.length) {
    return {
      weightedAverage: 0,
      repeatedIssueImpact: 0,
      repeatedIssueLabel: 'No repeated issues yet',
    };
  }

  const categoryFrequency = ratings.reduce((acc, entry) => {
    const key = String(entry.category || '').trim().toLowerCase();
    if (!key) return acc;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

  let totalWeight = 0;
  let weightedSum = 0;
  const issueFrequency = {};

  ratings.forEach((entry) => {
    const categoryKey = String(entry.category || '').trim().toLowerCase();
    const categoryWeight = Number(categoryFrequency[categoryKey] || 1);
    const score = Number(entry.score || 0);
    weightedSum += score * categoryWeight;
    totalWeight += categoryWeight;

    if (score < 0) {
      issueFrequency[categoryKey] = Number(issueFrequency[categoryKey] || 0) + 1;
    }
  });

  const repeatedIssues = Object.entries(issueFrequency)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  const repeatedIssueLabel = repeatedIssues.length
    ? `${repeatedIssues[0][0]} (${repeatedIssues[0][1]} repeats)`
    : 'No repeated issues yet';

  const repeatedIssueImpact = repeatedIssues.reduce((sum, [, count]) => sum + (count * count), 0);

  return {
    weightedAverage: Number((weightedSum / Math.max(totalWeight, 1)).toFixed(2)),
    repeatedIssueImpact: Number(repeatedIssueImpact.toFixed(2)),
    repeatedIssueLabel,
  };
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
    .map((entry) => `<li class="entry-row"><span><strong>${formatTimestamp(entry.createdAt)}:</strong> ${cleanFrontEndDisplayText(entry.note)}</span></li>`)
    .join('');

  return `<ul class="history-summary">${rows}</ul>`;
};

const renderHistorySummary = (historyEntries) => {
  if (!historyEntries?.length) {
    return '<p class="hint">No profile history entries saved yet.</p>';
  }

  const rows = historyEntries
    .map((entry) => {
      const detail = entry.note ? ` — ${cleanFrontEndDisplayText(entry.note)}` : '';
      return `<li><label><input type="checkbox" checked disabled /> ${entry.category}: ${entry.score}${detail} <span class="hint">(${formatTimestamp(entry.createdAt)})</span></label></li>`;
    })
    .join('');

  return `<ul class="history-summary">${rows}</ul>`;
};


const renderExactRatings = (profileId, ratings) => {
  if (!ratings?.length) {
    return '<p class="hint">No ratings saved yet.</p>';
  }

  const showRemoveActions = false;

  const rows = [...ratings]
    .sort((a, b) => new Date(b.ratedAt).getTime() - new Date(a.ratedAt).getTime())
    .map((entry) => {
      const date = formatTimestamp(entry.ratedAt);
      const note = entry.note ? `<p class="hint">${cleanFrontEndDisplayText(entry.note)}</p>` : '';
      const removeButton = showRemoveActions
        ? `<button type="button" class="secondary" data-delete-rating-id="${entry.id}" data-profile-id="${profileId}">Remove</button>`
        : '';
      return `<li class="entry-row"><div><strong>${date}</strong> — ${entry.category}: ${entry.score}${note}</div>${removeButton}</li>`;
    })
    .join('');

  return `<ul class="history-summary">${rows}</ul>`;
};

const matchesProfileSearch = (profile, rawTerm) => {
  const term = String(rawTerm || '').trim().toLowerCase();
  if (!term) return true;

  const haystack = [
    profile.name,
    ...(profile.jobCategories || []),
    profile.backgroundInfo,
  ].map((value) => String(value || '').toLowerCase()).join(' ');

  return haystack.includes(term);
};

const buildProfileCardMarkup = (profile, options = {}) => {
  const { condensed = false, rankPosition = null, totalWorkers = null } = options;
  const badgeClass = profile.ratings.length ? statusFromScore(profile.overallScore) : 'steady';
  const badgeLabel = profile.ratings.length ? statusLabelFromClass(badgeClass) : 'Unrated';
  const latestNote = profile.profileNotes?.length ? profile.profileNotes[profile.profileNotes.length - 1] : null;
  const rankMarkup = rankPosition ? `<span>Rank: #${rankPosition} out of ${totalWorkers}</span>` : '';

  if (condensed) {
    const topCategory = Array.isArray(profile.jobCategories) && profile.jobCategories.length ? profile.jobCategories[0] : 'No category yet';
    return `
      <div class="profile-item-head">
        <strong>${profile.name}</strong>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="meta compact-meta">
        <span>Score (1-10): ${toTenPointScale(profile.overallScore)}</span>
        <span>Jobs: ${computeJobsCount(profile)}</span>
        ${rankMarkup}
      </div>
      <p class="hint">Top category: ${topCategory}</p>
      <div class="row-actions"><button type="button" class="secondary" data-edit-profile-id="${profile.id}">Edit</button></div>
    `;
  }

  return `
    <div class="profile-item-head">
      <strong>${profile.name}</strong>
      <span class="badge ${badgeClass}">${badgeLabel}</span>
    </div>
    <div class="meta">
      <span>Categories: ${profile.jobCategories.join(', ') || '—'}</span>
      <span>Ratings: ${profile.ratings.length}</span>
      <span>Avg score (1-10): ${toTenPointScale(profile.overallScore)}</span>
      <span>Jobs: ${computeJobsCount(profile)}</span>
      ${rankMarkup}
    </div>
    ${latestNote ? `<p class="hint">Latest timed note (${formatTimestamp(latestNote.createdAt)}): ${latestNote.note}</p>` : ''}
    <div class="row-actions"><button type="button" class="secondary" data-edit-profile-id="${profile.id}">Edit</button></div>
  `;
};

const renderPreviewCards = (targetList, type) => {
  if (!targetList) return;
  if (type === 'top') {
    targetList.innerHTML = '<li class="profile-item top-performer-card"><div class="profile-item-head"><strong>Jasmine R.</strong><span class="badge top-performer">Reliable</span></div><div class="meta compact-meta"><span>Score (1-10): 9.6</span></div><p class="hint">Preview example worker</p></li>';
    return;
  }
  targetList.innerHTML = '<li class="profile-item at-risk-preview"><div class="profile-item-head"><strong>Test Bad</strong><span class="badge at-risk">Needs support</span></div><div class="meta compact-meta"><span>Score (1-10): 3.6</span></div><p class="hint">Preview example worker</p></li>';
};

const getBestPerCategoryProfiles = (profiles) => {
  const bestByCategory = new Map();

  profiles.forEach((profile) => {
    const summary = summarizeJobTypeScores(profile.ratings || []);
    summary.forEach((entry) => {
      const existing = bestByCategory.get(entry.jobType);
      if (!existing || Number(entry.average) > Number(existing.average)) {
        bestByCategory.set(entry.jobType, { profile, average: entry.average });
      }
    });
  });

  return [...new Map([...bestByCategory.values()].map((entry) => [String(entry.profile.id), entry.profile])).values()];
};

const profileMatchesCriterion = (profile, criterionName) => {
  if (!criterionName) return true;
  const normalized = String(criterionName).toLowerCase();
  return (profile.ratings || []).some((rating) => parseChecklistEntries(rating.note).some((entry) => entry.criterion.toLowerCase() === normalized));
};

const profileMatchesJobType = (profile, jobType) => {
  if (!jobType) return true;
  return (profile.ratings || []).some((rating) => String(rating.category || '').toLowerCase() === String(jobType).toLowerCase());
};

const renderWorkerSearchFilters = () => {
  if (workerSearchJobTypeSelect) {
    const previous = workerSearchJobTypeSelect.value;
    workerSearchJobTypeSelect.innerHTML = '<option value="">Any job type</option>';
    (adminSettings.jobTypes || []).forEach((jobType) => {
      const option = document.createElement('option');
      option.value = jobType;
      option.textContent = jobType;
      workerSearchJobTypeSelect.appendChild(option);
    });
    if ([...workerSearchJobTypeSelect.options].some((option) => option.value === previous)) {
      workerSearchJobTypeSelect.value = previous;
    }
  }

  if (workerSearchCriterionSelect) {
    const previous = workerSearchCriterionSelect.value;
    workerSearchCriterionSelect.innerHTML = '<option value="">Any checklist item</option>';
    ratingCriteria.forEach((criterion) => {
      const option = document.createElement('option');
      option.value = criterion.name;
      option.textContent = criterion.name;
      workerSearchCriterionSelect.appendChild(option);
    });
    if ([...workerSearchCriterionSelect.options].some((option) => option.value === previous)) {
      workerSearchCriterionSelect.value = previous;
    }
  }
};

const renderProfiles = (profiles) => {
  profilesList.innerHTML = '';
  if (topPerformersList) topPerformersList.innerHTML = '';

  const sorted = [...profiles].sort((a, b) => computeRankScore(b).rankScore - computeRankScore(a).rankScore);
  if (!sorted.length) {
    renderPreviewCards(topPerformersList, 'top');
    renderPreviewCards(profilesList, 'bad');
    return;
  }

  const topPerformers = sorted.slice(0, 3);
  const badWorkers = [...sorted].reverse().slice(0, 3);

  if (topPerformersList) {
    topPerformers.forEach((profile) => {
      const item = document.createElement('li');
      item.className = 'profile-item top-performer-card';
      const rankPosition = sorted.findIndex((entry) => String(entry.id) === String(profile.id)) + 1;
      item.innerHTML = buildProfileCardMarkup(profile, { condensed: true, rankPosition, totalWorkers: sorted.length });
      topPerformersList.appendChild(item);
    });
  }

  badWorkers.forEach((profile) => {
    const item = document.createElement('li');
    item.className = 'profile-item at-risk-preview';
    const rankPosition = sorted.findIndex((entry) => String(entry.id) === String(profile.id)) + 1;
    item.innerHTML = buildProfileCardMarkup(profile, { condensed: true, rankPosition, totalWorkers: sorted.length });
    profilesList.appendChild(item);
  });
};

const renderWorkerSearchResults = (profiles) => {
  if (!workerSearchResults) return;
  workerSearchResults.innerHTML = '';

  const mode = workerSearchModeSelect?.value || 'all';
  const term = String(workerSearchNameInput?.value || '').trim().toLowerCase();
  const selectedJobType = workerSearchJobTypeSelect?.value || '';
  const selectedCriterion = workerSearchCriterionSelect?.value || '';

  const sorted = [...profiles].sort((a, b) => computeRankScore(b).rankScore - computeRankScore(a).rankScore);
  let source = sorted;

  if (mode === 'top') source = sorted.slice(0, 8);
  if (mode === 'bad') source = [...sorted].reverse().slice(0, 8);
  if (mode === 'consistent') {
    source = [...sorted]
      .filter((profile) => (profile.ratings || []).length)
      .sort((a, b) => Number(b.analytics?.consistencyScore || 0) - Number(a.analytics?.consistencyScore || 0))
      .slice(0, 8);
  }
  if (mode === 'best-category') {
    source = getBestPerCategoryProfiles(sorted);
  }

  const filtered = source.filter((profile) => {
    const matchesName = !term || String(profile.name || '').toLowerCase().includes(term);
    return matchesName && profileMatchesJobType(profile, selectedJobType) && profileMatchesCriterion(profile, selectedCriterion);
  });

  if (!filtered.length) {
    workerSearchResults.innerHTML = '<li class="profile-item">No workers match this search yet.</li>';
    return;
  }

  filtered.forEach((profile) => {
    const rankPosition = sorted.findIndex((entry) => String(entry.id) === String(profile.id)) + 1;
    const item = document.createElement('li');
    item.className = 'profile-item';
    item.innerHTML = `
      <div class="profile-item-head">
        <strong>${profile.name}</strong>
        <button type="button" class="secondary" data-view-worker-id="${profile.id}">View</button>
      </div>
      <div class="meta">
        <span>Score (1-10): ${toTenPointScale(profile.overallScore)}</span>
        <span>Consistency: ${Number(profile.analytics?.consistencyScore || 0).toFixed(1)}%</span>
        <span>Jobs: ${computeJobsCount(profile)}</span>
        <span>Rank: #${rankPosition} out of ${sorted.length}</span>
      </div>
    `;
    workerSearchResults.appendChild(item);
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


const parseChecklistEntries = (noteText) => {
  const note = String(noteText || '');
  const match = note.match(/Checklist:\s*([^|]+)/);
  if (!match) return [];

  return match[1]
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const withoutScores = entry.replace(/\s*\(base:.*\)\s*$/, '').trim();
      const separator = withoutScores.indexOf('=');
      if (separator < 0) return null;

      return {
        criterion: withoutScores.slice(0, separator).trim(),
        label: withoutScores.slice(separator + 1).trim(),
      };
    })
    .filter(Boolean);
};

const parseReportsRangeToken = (token) => {
  const value = String(token || '').trim();
  if (!value) return null;

  if (/^-?\d+$/.test(value)) {
    const exact = Number(value);
    return Number.isFinite(exact) ? { type: 'exact', exact } : null;
  }

  const plusMatch = value.match(/^(\d+)\+$/);
  if (plusMatch) {
    return { type: 'min', min: Number(plusMatch[1]) };
  }

  const rangeMatch = value.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { type: 'range', min: Math.min(min, max), max: Math.max(min, max) };
  }

  return null;
};

const matchesReportsRange = (count, reportsRange) => {
  const normalizedCount = Number(count || 0);
  if (!reportsRange) return true;

  const tokens = String(reportsRange)
    .split(',')
    .map((entry) => parseReportsRangeToken(entry))
    .filter(Boolean);

  if (!tokens.length) return true;

  return tokens.some((token) => {
    if (token.type === 'exact') return normalizedCount === token.exact;
    if (token.type === 'min') return normalizedCount >= token.min;
    if (token.type === 'range') return normalizedCount >= token.min && normalizedCount <= token.max;
    return false;
  });
};

const computeChecklistSignals = (ratings) => {
  const reportCounts = new Map();

  ratings.forEach((rating) => {
    parseChecklistEntries(rating.note).forEach((entry) => {
      const key = `${entry.criterion.toLowerCase()}::${entry.label.toLowerCase()}`;
      reportCounts.set(key, Number(reportCounts.get(key) || 0) + 1);
    });
  });

  const rules = normalizeChecklistMathRules(adminSettings.checklistMathRules);
  const tags = normalizeCustomTags(adminSettings.customTags);

  const activeTags = [];
  const insights = [];

  rules.forEach((rule) => {
    const criterion = ratingCriteria.find((item) => item.id === rule.criterionId);
    const criterionName = String(criterion?.name || '').trim();
    const labelText = String(criterion?.labels?.[rule.labelScore] || '').trim();
    if (!criterionName || !labelText) return;

    const key = `${criterionName.toLowerCase()}::${labelText.toLowerCase()}`;
    const count = Number(reportCounts.get(key) || 0);

    if (!matchesReportsRange(count, rule.reportsRange)) return;

    if (rule.tag) {
      const matchingTag = tags.find((tag) => tag.label === rule.tag);
      activeTags.push({
        label: rule.tag,
        color: matchingTag?.color || '#eef1fb',
      });
    }

    if (rule.insight) {
      insights.push(rule.insight);
    }
  });

  const uniqueTags = [...new Map(activeTags.map((tag) => [tag.label.toLowerCase(), tag])).values()];
  const uniqueInsights = [...new Set(insights.map((entry) => entry.trim()).filter(Boolean))];

  return { tags: uniqueTags, insights: uniqueInsights };
};

const renderWorkerProfile = (profiles, workerId) => {
  if (!workerId) {
    workerProfileDetail.innerHTML = '<p class="hint">Choose a worker from search results to inspect category-level rating history, strengths, and trends.</p>';
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
  const checklistSignals = computeChecklistSignals(ratings);
  const weightedIndicators = computeFrequencyWeightedIndicators(ratings);

  const topJobTypeText = topJobTypes.length
    ? `${topJobTypes[0].jobType} (${topJobTypes[0].reviews} reviews, avg ${topJobTypes[0].average})`
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
  const sortedByRank = [...profiles].sort((a, b) => computeRankScore(b).rankScore - computeRankScore(a).rankScore);
  const rankPosition = Math.max(1, sortedByRank.findIndex((entry) => String(entry.id) === String(profile.id)) + 1);
  const totalWorkers = sortedByRank.length;
  const scoreTitle = performanceTierLabel(toTenPointScale(overallScore));
  workerProfileDetail.innerHTML = `
    <div class="profile-detail-header">
      <h3>${profile.name}</h3>
      <div class="profile-hero-score">
        <strong>${toTenPointScale(overallScore)}</strong>
        <span class="score-title">${scoreTitle}</span>
        <span class="hint">Rank: #${rankPosition} out of ${totalWorkers}</span>
      </div>
      <div class="profile-score-cards">
        <article class="profile-score-card">
          <p class="hint">Jobs (reviews)</p>
          <strong>${computeJobsCount(profile)}</strong>
        </article>
        <article class="profile-score-card">
          <p class="hint">Top job category</p>
          <strong>${topJobTypeText}</strong>
        </article>
        <article class="profile-score-card">
          <p class="hint">Weighted performance</p>
          <strong>${weightedIndicators.weightedAverage}</strong>
        </article>
        <article class="profile-score-card">
          <p class="hint">Repeated issue impact</p>
          <strong>${weightedIndicators.repeatedIssueImpact}</strong>
        </article>
      </div>
      <div class="meta">
        <span>Rank: #${rankPosition} out of ${totalWorkers}</span>
        <span>Positive streak: ${analytics.currentPositiveStreak || 0}</span>
        <span>${analytics.lateTrend || 'No punctuality trend yet'}</span>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="meta">
        <span>Issue tags:</span>
        ${checklistSignals.tags.length
    ? checklistSignals.tags.map((tag) => `<span class="badge custom-tag-preview" style="background:${tag.color}; color:#1f2330;">${tag.label}</span>`).join(' ')
    : '<span class="hint">No issue tags triggered yet.</span>'}
      </div>
      <p class="hint">Frequency-weighted issue trend: ${weightedIndicators.repeatedIssueLabel}</p>
      ${checklistSignals.insights.length
    ? `<p class="hint">Insights: ${checklistSignals.insights.join(' • ')}</p>`
    : ''}
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
      <div class="row-actions"><button type="button" class="secondary" data-edit-checklist-math-rule="${rule.id}">Edit</button><button type="button" class="secondary" data-duplicate-checklist-math-rule="${rule.id}">Duplicate</button><button type="button" class="secondary" data-delete-checklist-math-rule="${rule.id}">Delete</button></div>
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
      <div class="row-actions"><button type="button" class="secondary" data-edit-custom-tag="${tag.id}">Edit</button><button type="button" class="secondary" data-duplicate-custom-tag="${tag.id}">Duplicate</button>${tag.locked ? '<span class="hint">Locked</span>' : `<button type="button" class="secondary" data-delete-custom-tag="${tag.id}">Delete</button>`}</div>
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
      <div class="row-actions"><button type="button" class="secondary" data-edit-job-type="${jobType}">Edit</button><button type="button" class="secondary" data-delete-job-type="${jobType}">Delete</button></div>
    `;
    jobTypesList.appendChild(row);
  });

  renderCustomTagOptions();
  renderCustomTags();
  renderRecentTagColors();
  renderChecklistMathBuilderOptions();
  renderChecklistMathRules();
  renderAdminReviewLog();
  renderAdminProfileDeleteList(profilesCache);
  renderJobTypeOptions();
};

const syncStatusWeightsFromInputs = () => {
  PROFILE_STATUSES.forEach((status) => {
    const field = statusWeightsContainer?.querySelector(`[data-status-weight="${status}"]`);
    adminSettings.statusWeights[status] = Number(field?.value || 0);
  });
};

const persistAdminSettings = ({ rerenderAdmin = false, actionLabel = 'Admin settings updated' } = {}) => {
  const beforeSnapshot = captureStateSnapshot();
  saveAdminSettings();
  updateAdminCatalog();
  pushAdminBundleToBackend();
  if (rerenderAdmin) {
    renderAdminSettings();
  }
  renderAll(profilesCache);
  const afterSnapshot = captureStateSnapshot();
  recordStateChange(actionLabel, beforeSnapshot, afterSnapshot);
  renderAdminReviewLog();
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
      <div class="row-actions"><button type="button" class="secondary" data-edit-criterion="${criterion.id}">Edit</button><button type="button" class="secondary" data-delete-criterion="${criterion.id}">Delete</button></div>
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



const renderAdminReviewLog = () => {
  if (!adminReviewLog) return;

  if (!changeLogEntries.length) {
    adminReviewLog.innerHTML = '<p class="hint">No changes logged yet.</p>';
    updateChangeLogButtons();
    return;
  }

  const rows = [...changeLogEntries]
    .map((entry, index) => {
      const stateTag = index === changeLogCursor ? ' <span class="badge steady">Current</span>' : '';
      return `<li class="entry-row"><div><strong>${formatTimestamp(entry.createdAt)}</strong> — ${cleanFrontEndDisplayText(entry.label)}${stateTag}</div></li>`;
    })
    .reverse()
    .join('');

  adminReviewLog.innerHTML = `<ul class="history-summary">${rows}</ul>`;
  updateChangeLogButtons();
};

const renderAdminProfileDeleteList = (profiles) => {
  if (!adminProfileDeleteList) return;

  if (!profiles?.length) {
    adminProfileDeleteList.innerHTML = '<p class="hint">No profiles available.</p>';
    return;
  }

  const rows = [...profiles]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map((profile) => `<div class="problem-row"><span><strong>${profile.name}</strong> <span class="hint">(${(profile.ratings || []).length} ratings)</span></span><div class="row-actions"><button type="button" class="secondary" data-admin-delete-profile-id="${profile.id}">Delete profile</button></div></div>`)
    .join('');

  adminProfileDeleteList.innerHTML = rows;
};

const renderMaintenanceReport = (report) => {
  if (!maintenanceReport) return;
  const duplicates = report?.potentialDuplicates || [];
  const orphans = report?.orphans || {};

  maintenanceReport.innerHTML = `
    <div class="problem-row"><span><strong>Potential duplicates:</strong> ${duplicates.length}</span></div>
    ${duplicates.length ? duplicates.map((entry) => `<div class="problem-row"><span>${entry.canonicalName} (${entry.count}) — ${entry.workers}</span></div>`).join('') : '<p class="hint">No likely duplicates found.</p>'}
    <div class="problem-row"><span><strong>Orphan ratings:</strong> ${Number(orphans.ratings || 0)}</span></div>
    <div class="problem-row"><span><strong>Orphan history entries:</strong> ${Number(orphans.historyEntries || 0)}</span></div>
    <div class="problem-row"><span><strong>Orphan profile notes:</strong> ${Number(orphans.profileNotes || 0)}</span></div>
  `;
};

const refreshMaintenanceReport = async () => {
  if (!maintenanceReport) return;
  try {
    maintenanceReport.innerHTML = '<p class="hint">Loading maintenance report…</p>';
    const report = await fetchMaintenanceReport();
    renderMaintenanceReport(report);
  } catch (error) {
    maintenanceReport.innerHTML = `<p class="field-error">${error.message || 'Unable to load maintenance report.'}</p>`;
  }
};

const renderAll = (profiles) => {
  renderProfiles(profiles);
  renderWorkerSelector(profiles);
  renderWorkerSearchFilters();
  renderWorkerSearchResults(profiles);
  renderWorkerNameOptions(profiles);
  renderWorkerProfile(profiles, workerSelector.value);
  renderJobTypeOptions();
  renderCriterionRatings();
  renderRatingCriteriaRows();
  renderCustomTagOptions();
  renderCustomTags();
  renderRecentTagColors();
  renderChecklistMathBuilderOptions();
  renderChecklistMathRules();
  renderAdminReviewLog();
  renderAdminProfileDeleteList(profiles);
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
    if (!confirmAction('Do you really want to remove this history entry?')) return;
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
    if (!confirmAction('Do you really want to remove this profile note?')) return;
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


const resetProfileForm = () => {
  addProfileForm.reset();
  resetHistoryEntries();
  resetNoteEntries();
  editingProfileId = null;
  const headerTitle = document.querySelector('#profile-page h2');
  if (headerTitle) headerTitle.textContent = 'Create Worker Profile';
};

const openEditProfileForm = (profile) => {
  if (!profile) return;

  editingProfileId = profile.id;
  showProfilePage(true);
  const headerTitle = document.querySelector('#profile-page h2');
  if (headerTitle) headerTitle.textContent = `Edit Worker Profile: ${profile.name}`;

  const nameField = document.getElementById('profileName');
  const backgroundField = document.getElementById('profileBackground');
  const employeeIdField = document.getElementById('profileEmployeeId');

  if (nameField) nameField.value = profile.name || '';
  if (backgroundField) backgroundField.value = profile.backgroundInfo || '';
  if (employeeIdField) employeeIdField.value = profile.externalEmployeeId || '';

  resetHistoryEntries(profile.historyEntries || []);
  resetNoteEntries(profile.profileNotes || []);
};

const initializeStatusOptions = () => {
  const profileStatus = document.getElementById('profileStatus');
  if (!profileStatus) return;
  const existing = Array.from(profileStatus.options).map((option) => option.value);
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

const setDataSyncStatus = (message, isError = false) => {
  if (!dataSyncStatus) return;
  dataSyncStatus.textContent = message;
  dataSyncStatus.classList.toggle('field-error', isError);
};

const refreshFromBackend = async ({ silent = false } = {}) => {
  try {
    profilesCache = await fetchProfiles();
    renderAll(profilesCache);
    if (!silent) {
      setDataSyncStatus(`Data sync: up to date as of ${new Date().toLocaleTimeString()}.`);
    }
  } catch (error) {
    if (!silent) {
      setDataSyncStatus(`Data sync warning: ${error.message || 'Unable to sync right now.'}`, true);
    }
    throw error;
  }
};


let eventsConnection = null;
let eventsConnected = false;
let lastEventsErrorAt = 0;

const startRealtimeSync = () => {
  if (!window.EventSource) {
    setDataSyncStatus('Live sync unavailable in this browser. Using periodic refresh.');
    return;
  }

  if (eventsConnection) {
    eventsConnection.close();
  }

  eventsConnection = new EventSource(`${API_BASE}/events`);

  eventsConnection.addEventListener('open', () => {
    eventsConnected = true;
    setDataSyncStatus(`Live sync connected as of ${new Date().toLocaleTimeString()}.`);
  });

  eventsConnection.addEventListener('profiles_updated', () => {
    refreshFromBackend({ silent: true }).catch(() => {
      // keep UI stable while background refresh retries
    });
  });

  eventsConnection.addEventListener('admin_settings_updated', () => {
    pullAdminBundleFromBackend().then((didSync) => {
      if (didSync) {
        renderAdminSettings();
        renderRules();
        renderCriterionRatings();
      }
    }).catch(() => {
      // fallback to local state if bundle cannot be fetched
    });
  });

  eventsConnection.addEventListener('admin_catalog_updated', () => {
    pullAdminBundleFromBackend().then((didSync) => {
      if (didSync) {
        renderAdminSettings();
        renderRules();
        renderCriterionRatings();
      }
    }).catch(() => {
      // fallback to local state if bundle cannot be fetched
    });
  });

  eventsConnection.onerror = () => {
    eventsConnected = false;
    const now = Date.now();
    if (now - lastEventsErrorAt > 10000) {
      setDataSyncStatus('Live sync disconnected. Falling back to periodic refresh...', true);
      lastEventsErrorAt = now;
    }
  };
};

const setQuickWorkerFeedback = (message, isError = false) => {
  if (!quickWorkerFeedback) return;
  quickWorkerFeedback.textContent = message;
  quickWorkerFeedback.classList.toggle('field-error', isError);
};

const quickAddWorkerByName = async () => {
  if (!quickWorkerNameInput) return;
  if (!canAccessAdmin()) return;

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

const setTopTabState = (view) => {
  const isProfiles = view === 'profiles';
  const isRatings = view === 'ratings';
  const isAdmin = view === 'admin';

  tabProfiles?.classList.toggle('active', isProfiles);
  tabRatings?.classList.toggle('active', isRatings);
  tabAdmin?.classList.toggle('active', isAdmin);

  tabProfiles?.setAttribute('aria-selected', String(isProfiles));
  tabRatings?.setAttribute('aria-selected', String(isRatings));
  tabAdmin?.setAttribute('aria-selected', String(isAdmin));
};

const showMainView = (view) => {
  mainPage.classList.toggle('hidden', view !== 'profiles');
  ratingsPage?.classList.toggle('hidden', view !== 'ratings');
  profilePage.classList.add('hidden');
  adminPage.classList.add('hidden');
  setTopTabState(view);
};

const showProfilePage = (show, options = {}) => {
  const { requireAdminAccess = false } = options;
  if (show && requireAdminAccess && !canAccessAdmin()) {
    return;
  }

  mainPage.classList.add('hidden');
  ratingsPage?.classList.add('hidden');
  profilePage.classList.toggle('hidden', !show);
  adminPage.classList.add('hidden');
  setTopTabState('profiles');

  if (show) {
    history.pushState({ profilePage: true }, '', '#add-profile');
    document.getElementById('profileName').focus();
  } else if (window.location.hash === '#add-profile') {
    history.pushState({}, '', '#profiles');
    showMainView('profiles');
  }
};

const showAdminPage = (show) => {
  if (show && !canAccessAdmin()) {
    return;
  }

  if (!show) {
    setAdminUnlocked(false);
    showMainView('profiles');
    if (window.location.hash === '#admin-settings') {
      history.pushState({}, '', '#profiles');
    }
    return;
  }

  mainPage.classList.add('hidden');
  ratingsPage?.classList.add('hidden');
  profilePage.classList.add('hidden');
  adminPage.classList.remove('hidden');
  setTopTabState('admin');
  history.pushState({ adminPage: true }, '', '#admin-settings');
};


const ensurePanelOpen = (panel, focusField) => {
  if (!panel || !panel.classList.contains('hidden')) return true;
  panel.classList.remove('hidden');
  if (focusField instanceof HTMLElement) {
    focusField.focus();
  }
  return false;
};

const setupAdminSectionToggles = () => {
  document.querySelectorAll('#admin-settings-form .admin-section').forEach((section, index) => {
    const legend = section.querySelector('legend');
    if (!legend || legend.querySelector('[data-admin-section-toggle]')) return;

    section.classList.remove('is-open');
    section.classList.add('is-collapsed');
    section.setAttribute('data-admin-section-index', String(index + 1));

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-section-toggle';
    toggle.setAttribute('data-admin-section-toggle', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Expand';

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
  const dailyOutcome = data.get('dailyOutcome').toString().trim();
  const dailyOutcomeMap = {
    declined: { label: 'Declined work offered', score: 2 },
    worked: { label: 'Worked', score: 2.5 },
    repeated: { label: 'Worked and was requested back', score: 3 },
  };
  const outcome = dailyOutcomeMap[dailyOutcome] || null;

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
    outcome ? `Daily outcome: ${outcome.label}` : '',
    selectedCriteria.length ? `Checklist: ${selectedCriteria.map((entry) => `${entry.criterion}=${entry.label} (base:${entry.score}, weight:${entry.weightedScore})`).join('; ')}` : '',
    noteText,
  ].filter(Boolean).join(' | ');

  const jobType = data.get('jobType').toString().trim();

  return {
    workerName: data.get('workerName').toString().trim(),
    category: jobType,
    score: Number.isFinite(checklistAverage) ? checklistAverage : (outcome?.score ?? null),
    reviewer: 'Anonymous',
    note,
    selectedCriteria,
    externalEmployeeId: data.get('externalEmployeeId').toString().trim(),
    ratedAt: nowIso(),
  };
};

const submitRating = async (rating) => withChangeLog(`Rating saved for ${rating.workerName}`, async () => {
  const savedProfile = await saveRating(rating);
  await refreshFromBackend();
  workerSelector.value = String(savedProfile.id);
  renderWorkerProfile(profilesCache, savedProfile.id);
  return savedProfile;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const rating = buildRatingPayload(data);

  if (!Number.isFinite(rating.score)) {
    // eslint-disable-next-line no-alert
    alert('Select a daily work outcome to create a rating.');
    return;
  }

  const likelyDuplicates = findLikelyDuplicates(rating.workerName, rating.externalEmployeeId);
  if (likelyDuplicates.length) {
    const listText = likelyDuplicates.map((entry) => `${entry.name}${entry.externalEmployeeId ? ` (${entry.externalEmployeeId})` : ''}`).join(', ');
    if (!confirmAction(`Possible duplicate worker detected: ${listText}. Save anyway?`)) return;
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

if (tabProfiles) {
  tabProfiles.addEventListener('click', () => {
    if (window.location.hash === '#add-profile') {
      showProfilePage(false);
      return;
    }
    if (window.location.hash === '#admin-settings') {
      history.pushState({}, '', '#profiles');
    }
    showMainView('profiles');
  });
}

if (tabRatings) {
  tabRatings.addEventListener('click', () => {
    if (window.location.hash === '#admin-settings') {
      history.pushState({}, '', '#ratings');
    }
    showMainView('ratings');
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
    if (!ensurePanelOpen(addJobTypePanel, nameField)) return;

    const name = nameField.value.trim();
    if (!name) return;

    if ((adminSettings.jobTypes || []).some((jobType) => jobType.toLowerCase() === name.toLowerCase() && jobType !== editingJobTypeName)) return;

    if (editingJobTypeName) {
      adminSettings.jobTypes = (adminSettings.jobTypes || []).map((entry) => (entry === editingJobTypeName ? name : entry));
    } else {
      adminSettings.jobTypes.push(name);
    }

    editingJobTypeName = null;
    nameField.value = '';
    addJobTypePanel?.classList.add('hidden');
    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (jobTypesList) {
  jobTypesList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const jobTypeToEdit = target.getAttribute('data-edit-job-type');
    if (jobTypeToEdit) {
      const nameField = document.getElementById('job-type-name');
      if (!nameField) return;
      editingJobTypeName = jobTypeToEdit;
      addJobTypePanel?.classList.remove('hidden');
      nameField.value = jobTypeToEdit;
      nameField.focus();
      return;
    }

    const jobType = target.getAttribute('data-delete-job-type');
    if (!jobType) return;
    if (!confirmAction(`Do you really want to remove job type "${jobType}"?`)) return;

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
    const beforeSnapshot = captureStateSnapshot();
    const criterionNameInput = document.getElementById('criterion-name');
    if (!ensurePanelOpen(addRatingCriterionPanel, criterionNameInput)) return;

    const name = criterionNameInput.value.trim();
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

    const criterionPayload = {
      id: editingCriterionId || crypto.randomUUID(),
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
    };

    ratingCriteria = editingCriterionId
      ? ratingCriteria.map((entry) => (entry.id === editingCriterionId ? criterionPayload : entry))
      : [...ratingCriteria, criterionPayload];

    ['criterion-name', 'criterion-very-bad', 'criterion-little-bad', 'criterion-neutral', 'criterion-little-good', 'criterion-very-good'].forEach((fieldId) => {
      document.getElementById(fieldId).value = '';
    });
    document.getElementById('criterion-weight-very-bad').value = '-5';
    document.getElementById('criterion-weight-little-bad').value = '-2.5';
    document.getElementById('criterion-weight-neutral').value = '0';
    document.getElementById('criterion-weight-little-good').value = '2.5';
    document.getElementById('criterion-weight-very-good').value = '5';

    editingCriterionId = null;
    addRatingCriterionPanel?.classList.add('hidden');
    saveRatingCriteria();
    renderRatingCriteriaRows();
    recordStateChange('Checklist criteria updated', beforeSnapshot, captureStateSnapshot());
    renderAdminReviewLog();
  });
}

if (ratingCriteriaList) {
  ratingCriteriaList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const criterionIdToEdit = target.getAttribute('data-edit-criterion');
    if (criterionIdToEdit) {
      const criterion = ratingCriteria.find((entry) => entry.id === criterionIdToEdit);
      if (!criterion) return;

      editingCriterionId = criterionIdToEdit;
      addRatingCriterionPanel?.classList.remove('hidden');
      document.getElementById('criterion-name').value = criterion.name;
      document.getElementById('criterion-very-bad').value = criterion.labels['-5'] || '';
      document.getElementById('criterion-little-bad').value = criterion.labels['-2.5'] || '';
      document.getElementById('criterion-neutral').value = criterion.labels['0'] || '';
      document.getElementById('criterion-little-good').value = criterion.labels['2.5'] || '';
      document.getElementById('criterion-very-good').value = criterion.labels['5'] || '';
      document.getElementById('criterion-weight-very-bad').value = String(criterion.weights['-5'] ?? -5);
      document.getElementById('criterion-weight-little-bad').value = String(criterion.weights['-2.5'] ?? -2.5);
      document.getElementById('criterion-weight-neutral').value = String(criterion.weights['0'] ?? 0);
      document.getElementById('criterion-weight-little-good').value = String(criterion.weights['2.5'] ?? 2.5);
      document.getElementById('criterion-weight-very-good').value = String(criterion.weights['5'] ?? 5);
      document.getElementById('criterion-name').focus();
      return;
    }

    const criterionId = target.getAttribute('data-delete-criterion');
    if (!criterionId) return;
    if (!confirmAction('Do you really want to remove this checklist item?')) return;

    const beforeSnapshot = captureStateSnapshot();
    ratingCriteria = ratingCriteria.filter((criterion) => criterion.id !== criterionId);
    saveRatingCriteria();
    renderRatingCriteriaRows();
    recordStateChange('Checklist criterion deleted', beforeSnapshot, captureStateSnapshot());
    renderAdminReviewLog();
  });
}


if (addCustomTagButton) {
  addCustomTagButton.addEventListener('click', () => {
    if (!ensurePanelOpen(addCustomTagPanel, customTagNameInput)) return;
    if (customTagNameInput) customTagNameInput.disabled = false;

    const label = String(customTagNameInput?.value || '').trim();
    const color = normalizeColorHex(customTagColorInput?.value || '#5f8df5');
    if (!label) return;

    const tags = normalizeCustomTags(adminSettings.customTags);
    if (tags.some((tag) => tag.label.toLowerCase() === label.toLowerCase())) return;

    adminSettings.customTags = editingCustomTagId
      ? tags.map((tag) => {
        if (tag.id !== editingCustomTagId) return tag;
        if (tag.locked) return { ...tag, color };
        return { ...tag, label, color };
      })
      : [
        ...tags,
        { id: crypto.randomUUID(), label, color, locked: false },
      ];

    editingCustomTagId = null;
    if (customTagNameInput) customTagNameInput.value = '';
    if (customTagColorInput) customTagColorInput.value = '#5f8df5';
    saveRecentTagColor(color);
    addCustomTagPanel?.classList.add('hidden');
    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (customTagsList) {
  customTagsList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editTagId = target.getAttribute('data-edit-custom-tag');
    if (editTagId) {
      const tags = normalizeCustomTags(adminSettings.customTags);
      const selectedTag = tags.find((tag) => tag.id === editTagId);
      if (!selectedTag) return;

      editingCustomTagId = editTagId;
      addCustomTagPanel?.classList.remove('hidden');
      if (customTagNameInput) {
        customTagNameInput.value = selectedTag.label;
        customTagNameInput.disabled = selectedTag.locked;
      }
      if (customTagColorInput) customTagColorInput.value = normalizeColorHex(selectedTag.color || '#5f8df5');
      if (!selectedTag.locked) customTagNameInput?.focus();
      return;
    }

    const duplicateTagId = target.getAttribute('data-duplicate-custom-tag');
    if (duplicateTagId) {
      const tags = normalizeCustomTags(adminSettings.customTags);
      const selectedTag = tags.find((tag) => tag.id === duplicateTagId);
      if (!selectedTag) return;

      editingCustomTagId = null;
      addCustomTagPanel?.classList.remove('hidden');
      if (customTagNameInput) {
        customTagNameInput.disabled = false;
        customTagNameInput.value = `${selectedTag.label} Copy`;
        customTagNameInput.focus();
      }
      if (customTagColorInput) customTagColorInput.value = normalizeColorHex(selectedTag.color || '#5f8df5');
      return;
    }

    const tagId = target.getAttribute('data-delete-custom-tag');
    if (!tagId) return;
    if (!confirmAction('Do you really want to remove this tag?')) return;

    adminSettings.customTags = normalizeCustomTags(adminSettings.customTags)
      .filter((tag) => tag.id !== tagId || tag.locked);
    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (customTagColorInput) {
  customTagColorInput.addEventListener('change', () => {
    saveRecentTagColor(customTagColorInput.value);
    renderRecentTagColors();
  });
}

if (customTagRecentColors) {
  customTagRecentColors.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const color = target.getAttribute('data-recent-tag-color');
    if (!color || !customTagColorInput) return;
    customTagColorInput.value = color;
    saveRecentTagColor(color);
    renderRecentTagColors();
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
    if (!ensurePanelOpen(addChecklistMathRulePanel, mathMainCriterionSelect)) return;

    const criterionId = String(mathMainCriterionSelect?.value || '').trim();
    const labelScore = String(mathLabelSelect?.value || '').trim();
    const reportsRange = String(mathReportRangeInput?.value || '').trim();
    const weightMultiplier = Number(mathWeightMultiplierInput?.value || 1);
    const tag = String(mathTagInput?.value || '').trim();
    const insight = String(mathInsightInput?.value || '').trim();

    if (!criterionId || !labelScore) return;
    if (!Number.isFinite(weightMultiplier) || weightMultiplier < 0) return;

    const rules = normalizeChecklistMathRules(adminSettings.checklistMathRules);
    adminSettings.checklistMathRules = editingChecklistMathRuleId
      ? rules.map((rule) => (
        rule.id === editingChecklistMathRuleId
          ? {
            ...rule,
            criterionId,
            labelScore,
            reportsRange,
            weightMultiplier,
            tag,
            insight,
          }
          : rule
      ))
      : [
        ...rules,
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

    editingChecklistMathRuleId = null;
    if (mathReportRangeInput) mathReportRangeInput.value = '';
    if (mathWeightMultiplierInput) mathWeightMultiplierInput.value = '1';
    if (mathTagInput) mathTagInput.value = '';
    if (mathInsightInput) mathInsightInput.value = '';

    addChecklistMathRulePanel?.classList.add('hidden');
    persistAdminSettings({ rerenderAdmin: true });
  });
}

if (checklistMathRulesList) {
  checklistMathRulesList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editRuleId = target.getAttribute('data-edit-checklist-math-rule');
    if (editRuleId) {
      const rules = normalizeChecklistMathRules(adminSettings.checklistMathRules);
      const selectedRule = rules.find((rule) => rule.id === editRuleId);
      if (!selectedRule) return;

      editingChecklistMathRuleId = editRuleId;
      addChecklistMathRulePanel?.classList.remove('hidden');
      if (mathMainCriterionSelect) {
        mathMainCriterionSelect.value = selectedRule.criterionId;
        mathMainCriterionSelect.dispatchEvent(new Event('change'));
      }
      if (mathLabelSelect) mathLabelSelect.value = selectedRule.labelScore;
      if (mathReportRangeInput) mathReportRangeInput.value = selectedRule.reportsRange || '';
      if (mathWeightMultiplierInput) mathWeightMultiplierInput.value = String(selectedRule.weightMultiplier);
      if (mathTagInput) mathTagInput.value = selectedRule.tag || '';
      if (mathInsightInput) mathInsightInput.value = selectedRule.insight || '';
      return;
    }

    const duplicateRuleId = target.getAttribute('data-duplicate-checklist-math-rule');
    if (duplicateRuleId) {
      const rules = normalizeChecklistMathRules(adminSettings.checklistMathRules);
      const selectedRule = rules.find((rule) => rule.id === duplicateRuleId);
      if (!selectedRule) return;

      editingChecklistMathRuleId = null;
      addChecklistMathRulePanel?.classList.remove('hidden');
      if (mathMainCriterionSelect) {
        mathMainCriterionSelect.value = selectedRule.criterionId;
        mathMainCriterionSelect.dispatchEvent(new Event('change'));
      }
      if (mathLabelSelect) mathLabelSelect.value = selectedRule.labelScore;
      if (mathReportRangeInput) mathReportRangeInput.value = selectedRule.reportsRange || '';
      if (mathWeightMultiplierInput) mathWeightMultiplierInput.value = String(selectedRule.weightMultiplier);
      if (mathTagInput) mathTagInput.value = selectedRule.tag || '';
      if (mathInsightInput) mathInsightInput.value = selectedRule.insight || '';
      return;
    }

    const ruleId = target.getAttribute('data-delete-checklist-math-rule');
    if (!ruleId) return;
    if (!confirmAction('Do you really want to remove this checklist math rule?')) return;

    adminSettings.checklistMathRules = normalizeChecklistMathRules(adminSettings.checklistMathRules)
      .filter((rule) => rule.id !== ruleId);
    persistAdminSettings({ rerenderAdmin: true });
  });
}




if (adminLogUndoButton) {
  adminLogUndoButton.addEventListener('click', async () => {
    try {
      await undoStateChange();
    } catch (error) {
      alert(error.message || 'Unable to undo change.');
    }
  });
}

if (adminLogRedoButton) {
  adminLogRedoButton.addEventListener('click', async () => {
    try {
      await redoStateChange();
    } catch (error) {
      alert(error.message || 'Unable to redo change.');
    }
  });
}

if (adminProfileDeleteList) {
  adminProfileDeleteList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const profileIdToDelete = target.getAttribute('data-admin-delete-profile-id');
    if (!profileIdToDelete) return;

    const profile = profilesCache.find((entry) => String(entry.id) === String(profileIdToDelete));
    if (!profile) return;

    if (!confirmAction(`Delete profile "${profile.name}" and all linked data? This cannot be undone.`)) return;

    try {
      await withChangeLog(`Profile deleted: ${profile.name}`, async () => {
        await deleteProfile(profileIdToDelete);
        await refreshFromBackend({ silent: true });
      });
    } catch (error) {
      alert(error.message || 'Unable to delete profile.');
    }
  });
}


if (profilesList) {
  profilesList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const profileIdToEdit = target.getAttribute('data-edit-profile-id');
    if (profileIdToEdit) {
      const profile = profilesCache.find((entry) => String(entry.id) === String(profileIdToEdit));
      if (!profile) return;
      openEditProfileForm(profile);
      return;
    }

    const profileIdToDelete = target.getAttribute('data-delete-profile-id');
    if (!profileIdToDelete) return;

    const profile = profilesCache.find((entry) => String(entry.id) === String(profileIdToDelete));
    if (!profile) return;
    alert(`Deleting profiles is admin-only. "${profile.name}" can be edited from the front end but not deleted here.`);
  });
}


if (workerSearchResults) {
  workerSearchResults.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const workerId = target.getAttribute('data-view-worker-id');
    if (!workerId) return;
    workerSelector.value = String(workerId);
    renderWorkerProfile(profilesCache, workerId);
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
      alert('Deleting ratings is admin-only and unavailable on the front end.');
      return;
    }

    const noteId = target.getAttribute('data-delete-note-id');
    if (noteId) {
      alert('Deleting notes is admin-only and unavailable on the front end.');
    }
  });
}

addProfileButton.addEventListener('click', () => {
  resetProfileForm();
  showProfilePage(true);
});

addHistoryEntryButton.addEventListener('click', () => {
  profileHistoryList.appendChild(buildHistoryEntryRow());
});

addNoteEntryButton.addEventListener('click', () => {
  profileNotesList.appendChild(buildNoteEntryRow());
});

cancelAddProfileButton.addEventListener('click', () => {
  resetProfileForm();
  showProfilePage(false);
});

addProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(addProfileForm);
  const profilePayload = {
    name: data.get('name').toString().trim(),
    status: data.get('status') ? data.get('status').toString().trim() : '',
    background: data.get('background').toString().trim(),
    externalEmployeeId: data.get('externalEmployeeId').toString().trim(),
    historyEntries: collectHistoryEntries(),
    profileNotes: collectProfileNotes(),
  };

  const likelyDuplicates = findLikelyDuplicates(profilePayload.name, profilePayload.externalEmployeeId, editingProfileId);
  if (likelyDuplicates.length) {
    const firstMatch = likelyDuplicates[0];
    const shouldMerge = confirmAction(`Likely duplicate found (${firstMatch.name}). Click OK to merge into existing profile, or Cancel to continue without merge.`);
    if (shouldMerge && editingProfileId) {
      try {
        await mergeProfiles(editingProfileId, firstMatch.id);
        await refreshFromBackend();
        return;
      } catch (error) {
        alert(error.message || 'Unable to merge profiles');
        return;
      }
    }
  }

  try {
    const modeLabel = editingProfileId ? `Profile updated: ${profilePayload.name}` : `Profile created: ${profilePayload.name}`;
    const savedProfile = await withChangeLog(modeLabel, async () => {
      const profileResult = editingProfileId
        ? await updateProfile(editingProfileId, profilePayload)
        : await addProfile(profilePayload);
      await refreshFromBackend();
      return profileResult;
    });
    workerSelector.value = String(savedProfile.id);
    renderWorkerProfile(profilesCache, savedProfile.id);
    document.getElementById('workerName').value = savedProfile.name;
    resetProfileForm();
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

if (refreshMaintenanceReportButton) {
  refreshMaintenanceReportButton.addEventListener('click', async () => {
    await refreshMaintenanceReport();
  });
}

if (refreshProfilesButton) {
  refreshProfilesButton.addEventListener('click', async () => {
    try {
      await refreshFromBackend();
    } catch {
      // status text already updated in refreshFromBackend
    }
  });
}


if (profileSearchInput) {
  profileSearchInput.addEventListener('input', () => {
    renderProfiles(profilesCache);
  });
}

[workerSearchNameInput, workerSearchModeSelect, workerSearchJobTypeSelect, workerSearchCriterionSelect]
  .filter(Boolean)
  .forEach((field) => {
    field.addEventListener('input', () => {
      renderWorkerSearchResults(profilesCache);
    });
    field.addEventListener('change', () => {
      renderWorkerSearchResults(profilesCache);
    });
  });

if (workerSearchResetButton) {
  workerSearchResetButton.addEventListener('click', () => {
    if (workerSearchNameInput) workerSearchNameInput.value = '';
    if (workerSearchModeSelect) workerSearchModeSelect.value = 'all';
    if (workerSearchJobTypeSelect) workerSearchJobTypeSelect.value = '';
    if (workerSearchCriterionSelect) workerSearchCriterionSelect.value = '';
    renderWorkerSearchResults(profilesCache);
  });
}

clearButton.addEventListener('click', async () => {
  if (!canAccessAdmin()) return;
  if (!confirmAction('Do you really want to clear?')) return;
  try {
    await withChangeLog('Cleared all profiles', async () => {
      await clearProfiles();
      workerSelector.value = '';
      await refreshFromBackend();
    });
  } catch (error) {
    // eslint-disable-next-line no-alert
    alert(error.message);
  }
});


const buildBrowserBackupPayload = () => ({
  version: 1,
  exportedAt: nowIso(),
  data: {
    profiles: loadLocalProfiles(),
    adminSettings,
    ratingCriteria,
    ratingRules,
    recentTagColors: loadRecentTagColors(),
  },
});

const downloadBrowserBackup = () => {
  const payload = buildBrowserBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `worker-ratings-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const restoreBrowserBackup = async (file) => {
  const raw = await file.text();
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !parsed.data) {
    throw new Error('Backup file format is invalid.');
  }

  const backup = parsed.data;
  if (Array.isArray(backup.profiles)) {
    saveLocalProfiles(backup.profiles);
  }
  if (backup.adminSettings && typeof backup.adminSettings === 'object') {
    adminSettings = {
      ...adminSettings,
      ...backup.adminSettings,
      checklistMathRules: normalizeChecklistMathRules(backup.adminSettings.checklistMathRules),
      customTags: normalizeCustomTags(backup.adminSettings.customTags),
    };
    saveAdminSettings();
  }
  if (Array.isArray(backup.ratingCriteria)) {
    localStorage.setItem(RATING_CRITERIA_KEY, JSON.stringify(backup.ratingCriteria));
    ratingCriteria = loadRatingCriteria();
  }
  if (Array.isArray(backup.ratingRules)) {
    ratingRules = backup.ratingRules;
    localStorage.setItem(RATING_RULES_KEY, JSON.stringify(backup.ratingRules));
  }
  if (Array.isArray(backup.recentTagColors)) {
    localStorage.setItem(RECENT_TAG_COLORS_KEY, JSON.stringify(backup.recentTagColors));
  }

  await pushAdminBundleToBackend();
  renderAdminSettings();
  renderRules();
  renderCriterionRatings();
  await refreshFromBackend();
};

if (downloadBrowserBackupButton) {
  downloadBrowserBackupButton.addEventListener('click', () => {
    downloadBrowserBackup();
  });
}

if (restoreBrowserBackupInput) {
  restoreBrowserBackupInput.addEventListener('change', async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    try {
      await withChangeLog('Browser backup restored', async () => {
        await restoreBrowserBackup(file);
      });
      alert('Backup restored. Shared settings were synced.');
    } catch (error) {
      alert(error.message || 'Unable to restore backup file.');
    } finally {
      restoreBrowserBackupInput.value = '';
    }
  });
}

window.addEventListener('popstate', () => {
  const hash = window.location.hash;
  if (hash === '#admin-settings') {
    showAdminPage(true);
    return;
  }
  if (hash === '#add-profile') {
    showProfilePage(true, { requireAdminAccess: true });
    return;
  }
  if (hash === '#ratings') {
    showMainView('ratings');
    return;
  }

  showMainView('profiles');
});

if (!localStorage.getItem(ADMIN_ACCESS_PASSWORD_KEY)) {
  localStorage.setItem(ADMIN_ACCESS_PASSWORD_KEY, DEFAULT_ADMIN_ACCESS_PASSWORD);
}

adminSettings = loadAdminSettings();
ratingRules = loadRatingRules();
ratingCriteria = loadRatingCriteria();
loadChangeLog();
initializeStatusOptions();
renderRules();
renderAdminSettings();
renderAdminReviewLog();
setupAdminSectionToggles();
resetHistoryEntries();
resetNoteEntries();
setDataSyncStatus('Data sync: loading latest backend changes...');
pullAdminBundleFromBackend().then((didSync) => {
  if (didSync) {
    renderAdminSettings();
    renderRules();
  }
}).catch(() => {
  // keep local state if shared settings cannot be loaded
});
if (window.location.hash === '#admin-settings') {
  showAdminPage(true);
} else if (window.location.hash === '#add-profile') {
  showProfilePage(true, { requireAdminAccess: true });
} else if (window.location.hash === '#ratings') {
  showMainView('ratings');
} else {
  showMainView('profiles');
}
refreshFromBackend().catch((error) => {
  workerProfileDetail.innerHTML = `<p class="hint">Backend unavailable: ${error.message}</p>`;
});

startRealtimeSync();
window.setInterval(() => {
  if (eventsConnected) return;
  refreshFromBackend({ silent: true }).catch(() => {
    // background sync should never interrupt users
  });
}, AUTO_SYNC_INTERVAL_MS);

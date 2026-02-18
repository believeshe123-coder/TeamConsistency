const STORAGE_KEY = 'worker_profiles_v1';
const RATING_CATEGORIES = ['Punctuality', 'Skill', 'Teamwork'];

const form = document.getElementById('rating-form');
const profilesList = document.getElementById('profiles');
const clearButton = document.getElementById('clear-data');
const categorySelect = document.getElementById('category');
const workerSelector = document.getElementById('worker-selector');
const workerProfileDetail = document.getElementById('worker-profile-detail');

const statusFromScore = (score) => {
  if (score >= 4.2) return 'top-performer';
  if (score <= 2.5) return 'at-risk';
  return 'steady';
};

const sanitizeRating = (rawRating) => ({
  category: rawRating.category,
  score: Number(rawRating.score),
  reviewer: rawRating.reviewer,
  note: rawRating.note ?? '',
  ratedAt: rawRating.ratedAt,
});

const normalizeProfile = (profile) => {
  const ratings = Array.isArray(profile.ratings) ? profile.ratings.map(sanitizeRating) : [];

  const categoryHistory = RATING_CATEGORIES.reduce((history, category) => {
    const legacyEntries = Array.isArray(profile.categoryHistory?.[category])
      ? profile.categoryHistory[category].map(sanitizeRating)
      : [];
    const fallbackEntries = ratings.filter((rating) => rating.category === category);

    history[category] = [...legacyEntries, ...fallbackEntries].sort(
      (a, b) => new Date(a.ratedAt).getTime() - new Date(b.ratedAt).getTime(),
    );
    return history;
  }, {});

  const strengths = Array.isArray(profile.strengths) ? profile.strengths : [];
  const weaknesses = Array.isArray(profile.weaknesses) ? profile.weaknesses : [];
  const jobCategories = Array.isArray(profile.jobCategories)
    ? profile.jobCategories.filter((category) => RATING_CATEGORIES.includes(category))
    : [];

  const total = ratings.reduce((sum, entry) => sum + Number(entry.score), 0);
  const overallScore = ratings.length ? Number((total / ratings.length).toFixed(2)) : 0;

  return {
    ...profile,
    ratings,
    categoryHistory,
    strengths,
    weaknesses,
    jobCategories: Array.from(new Set(jobCategories)),
    overallScore,
    overallStatus: statusFromScore(overallScore),
  };
};

const loadProfiles = () => {
  try {
    const parsedProfiles = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(parsedProfiles)) return [];
    return parsedProfiles.map(normalizeProfile);
  } catch {
    return [];
  }
};

const saveProfiles = (profiles) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
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

const upsertProfile = (profiles, rating) => {
  const existing = profiles.find((profile) => profile.name.toLowerCase() === rating.workerName.toLowerCase());

  if (!existing) {
    const categoryHistory = RATING_CATEGORIES.reduce((history, category) => {
      history[category] = category === rating.category ? [rating] : [];
      return history;
    }, {});

    profiles.push({
      name: rating.workerName,
      jobCategories: [rating.category],
      ratings: [rating],
      categoryHistory,
      strengths: rating.note ? [rating.note] : [],
      weaknesses: [],
      overallScore: rating.score,
      overallStatus: statusFromScore(rating.score),
    });
    return profiles;
  }

  existing.ratings.push(rating);
  if (!existing.jobCategories.includes(rating.category)) existing.jobCategories.push(rating.category);

  if (!existing.categoryHistory) {
    existing.categoryHistory = RATING_CATEGORIES.reduce((history, category) => {
      history[category] = [];
      return history;
    }, {});
  }

  existing.categoryHistory[rating.category] = [...(existing.categoryHistory[rating.category] ?? []), rating].sort(
    (a, b) => new Date(a.ratedAt).getTime() - new Date(b.ratedAt).getTime(),
  );

  if (rating.note) existing.strengths.push(rating.note);

  const total = existing.ratings.reduce((sum, entry) => sum + Number(entry.score), 0);
  existing.overallScore = Number((total / existing.ratings.length).toFixed(2));
  existing.overallStatus = statusFromScore(existing.overallScore);

  return profiles;
};

const renderProfiles = (profiles) => {
  profilesList.innerHTML = '';

  const sorted = [...profiles].sort((a, b) => b.overallScore - a.overallScore);
  if (sorted.length === 0) {
    profilesList.innerHTML = '<li class="profile-item">No workers yet. Add a rating to start building profiles.</li>';
    return;
  }

  sorted.forEach((profile) => {
    const item = document.createElement('li');
    item.className = 'profile-item';
    item.innerHTML = `
      <strong>${profile.name}</strong>
      <div class="meta">
        <span>Categories: ${profile.jobCategories.join(', ') || '—'}</span>
        <span>Ratings: ${profile.ratings.length}</span>
        <span>Avg score: ${profile.overallScore}</span>
        <span class="badge ${profile.overallStatus}">${profile.overallStatus}</span>
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
    option.value = profile.name;
    option.textContent = profile.name;
    workerSelector.appendChild(option);
  });
};

const renderWorkerProfile = (profiles, workerName) => {
  if (!workerName) {
    workerProfileDetail.innerHTML = '<p class="hint">Choose a worker to inspect category-level rating history and trends.</p>';
    return;
  }

  const profile = profiles.find((entry) => entry.name === workerName);
  if (!profile) {
    workerProfileDetail.innerHTML = '<p class="hint">Worker profile not found.</p>';
    return;
  }

  const categorySections = RATING_CATEGORIES.map((category) => {
    const history = profile.categoryHistory?.[category] ?? [];
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

  workerProfileDetail.innerHTML = `
    <div class="profile-detail-header">
      <h3>${profile.name}</h3>
      <div class="meta">
        <span>Total ratings: ${profile.ratings.length}</span>
        <span>Overall avg: ${profile.overallScore}</span>
        <span class="badge ${profile.overallStatus}">${profile.overallStatus}</span>
      </div>
    </div>
    <div class="category-history-grid">${categorySections}</div>
  `;
};

const renderAll = (profiles) => {
  renderProfiles(profiles);
  renderWorkerSelector(profiles);
  renderWorkerProfile(profiles, workerSelector.value);
};

const initializeCategoryOptions = () => {
  categorySelect.innerHTML = '';

  RATING_CATEGORIES.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
};

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const rating = {
    workerName: data.get('workerName').toString().trim(),
    category: data.get('category').toString().trim(),
    score: Number(data.get('score')),
    reviewer: data.get('reviewer').toString().trim(),
    note: data.get('note').toString().trim(),
    ratedAt: new Date().toISOString(),
  };

  const profiles = upsertProfile(loadProfiles(), rating);
  saveProfiles(profiles);
  renderAll(profiles);
  workerSelector.value = rating.workerName;
  renderWorkerProfile(profiles, rating.workerName);
  form.reset();
  document.getElementById('score').value = '3';
  categorySelect.value = RATING_CATEGORIES[0];
});

workerSelector.addEventListener('change', () => {
  renderWorkerProfile(loadProfiles(), workerSelector.value);
});

clearButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  workerSelector.value = '';
  renderAll([]);
});

initializeCategoryOptions();
renderAll(loadProfiles());

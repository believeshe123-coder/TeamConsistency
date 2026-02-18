const STORAGE_KEY = 'worker_profiles_v1';

const form = document.getElementById('rating-form');
const profilesList = document.getElementById('profiles');
const clearButton = document.getElementById('clear-data');

const statusFromScore = (score) => {
  if (score >= 4.2) return 'top-performer';
  if (score <= 2.5) return 'at-risk';
  return 'steady';
};

const loadProfiles = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
};

const saveProfiles = (profiles) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
};

const upsertProfile = (profiles, rating) => {
  const existing = profiles.find((profile) => profile.name.toLowerCase() === rating.workerName.toLowerCase());

  if (!existing) {
    profiles.push({
      name: rating.workerName,
      jobCategories: [rating.category],
      ratings: [rating],
      strengths: rating.note ? [rating.note] : [],
      weaknesses: [],
      overallScore: rating.score,
      overallStatus: statusFromScore(rating.score),
    });
    return profiles;
  }

  existing.ratings.push(rating);
  if (!existing.jobCategories.includes(rating.category)) existing.jobCategories.push(rating.category);
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
        <span>Categories: ${profile.jobCategories.join(', ')}</span>
        <span>Ratings: ${profile.ratings.length}</span>
        <span>Avg score: ${profile.overallScore}</span>
        <span class="badge ${profile.overallStatus}">${profile.overallStatus}</span>
      </div>
    `;
    profilesList.appendChild(item);
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
  renderProfiles(profiles);
  form.reset();
  document.getElementById('score').value = '3';
});

clearButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  renderProfiles([]);
});

renderProfiles(loadProfiles());

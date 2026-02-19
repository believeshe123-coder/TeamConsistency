import { FormEvent, useMemo, useState } from 'react';
import { WorkerRatingEntry } from '../models/worker';

export interface RatingInputPayload {
  workerName: string;
  category: string;
  score: number;
  note?: string;
  reviewer: string;
}

interface RatingInputFormProps {
  categories: string[];
  reviewers: string[];
  onSubmit: (payload: RatingInputPayload) => void;
}

const DEFAULT_SCORE = 5;

export function RatingInputForm({ categories, reviewers, onSubmit }: RatingInputFormProps) {
  const [workerName, setWorkerName] = useState('');
  const [category, setCategory] = useState('');
  const [score, setScore] = useState(DEFAULT_SCORE);
  const [note, setNote] = useState('');
  const [reviewer, setReviewer] = useState(reviewers[0] ?? '');

  const canSubmit = useMemo(() => {
    return workerName.trim().length > 1 && reviewer.length > 0;
  }, [workerName, reviewer]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onSubmit({
      workerName: workerName.trim(),
      category,
      score,
      note: note.trim() || undefined,
      reviewer,
    });

    setScore(DEFAULT_SCORE);
    setNote('');
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Worker rating input form">
      <div>
        <label htmlFor="worker-name">Worker name</label>
        <input
          id="worker-name"
          value={workerName}
          onChange={(event) => setWorkerName(event.target.value)}
          placeholder="e.g., Jordan Patel"
          required
        />
      </div>

      <div>
        <label htmlFor="job-category">Job type (optional)</label>
        <select
          id="job-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">No job type selected</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="score">Score (1-10)</label>
        <input
          id="score"
          type="number"
          min={1}
          max={10}
          step={0.1}
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          required
        />
      </div>

      <p className="score-guidance" role="note">
        Scoring guide: 1 = unacceptable performance, 5 = baseline (just did the job), 10 = exceptional
        performance. Use the full 1-10 range for consistent reviews.
      </p>

      <div>
        <label htmlFor="reviewer">Reviewer</label>
        <select
          id="reviewer"
          value={reviewer}
          onChange={(event) => setReviewer(event.target.value)}
          required
        >
          {reviewers.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="note">Context / note</label>
        <textarea
          id="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add strengths/weaknesses observed during this shift..."
          rows={4}
        />
      </div>

      <button type="submit" disabled={!canSubmit}>
        Save rating
      </button>
    </form>
  );
}

export function toWorkerRatingEntry(payload: RatingInputPayload): WorkerRatingEntry {
  return {
    category: payload.category,
    score: payload.score,
    note: payload.note,
    reviewer: payload.reviewer,
    ratedAt: new Date().toISOString(),
  };
}

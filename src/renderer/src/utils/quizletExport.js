/**
 * Export quizzes and flashcards to Quizlet-compatible formats
 */

/**
 * Export flashcards as CSV format compatible with Quizlet
 * Quizlet CSV format: term,definition (one per line)
 */
export function exportFlashcardsToCSV(flashcards, topicName = 'Flashcards') {
  if (!flashcards || flashcards.length === 0) {
    throw new Error('No flashcards to export');
  }

  // Create CSV rows
  const rows = flashcards.map(card => {
    // Escape quotes and wrap in quotes if needed
    const front = escapeCSV(card.front || '');
    const back = escapeCSV(card.back || '');
    return `${front},${back}`;
  });

  // Add header
  const csv = ['term,definition', ...rows].join('\n');

  // Download file
  downloadFile(csv, `${topicName}_flashcards.csv`, 'text/csv');
}

/**
 * Export quiz to Quizlet-compatible CSV format
 * For quizzes, we'll create one line per question with all choices
 */
export function exportQuizToCSV(quiz, topicName = 'Quiz') {
  if (!quiz || quiz.length === 0) {
    throw new Error('No quiz questions to export');
  }

  const rows = quiz.map((q, index) => {
    const question = escapeCSV(q.question || '');
    const correctAnswer = escapeCSV(q.choices?.[q.answer] || '');
    const explanation = escapeCSV(q.explanation || '');
    
    // Format: Question, Correct Answer, Explanation
    return `"${question}","${correctAnswer}","${explanation}"`;
  });

  const csv = ['question,answer,explanation', ...rows].join('\n');

  downloadFile(csv, `${topicName}_quiz.csv`, 'text/csv');
}

/**
 * Export as TSV (tab-separated values) format
 * Quizlet also accepts TSV format
 */
export function exportFlashcardsToTSV(flashcards, topicName = 'Flashcards') {
  if (!flashcards || flashcards.length === 0) {
    throw new Error('No flashcards to export');
  }

  const rows = flashcards.map(card => {
    const front = (card.front || '').replace(/\t/g, ' ').replace(/\n/g, ' ');
    const back = (card.back || '').replace(/\t/g, ' ').replace(/\n/g, ' ');
    return `${front}\t${back}`;
  });

  const tsv = rows.join('\n');

  downloadFile(tsv, `${topicName}_flashcards.tsv`, 'text/tab-separated-values');
}

/**
 * Copy flashcards to clipboard in Quizlet format
 */
export async function copyFlashcardsToClipboard(flashcards) {
  if (!flashcards || flashcards.length === 0) {
    throw new Error('No flashcards to copy');
  }

  const lines = flashcards.map(card => {
    const front = (card.front || '').replace(/\n/g, ' ');
    const back = (card.back || '').replace(/\n/g, ' ');
    return `${front}\t${back}`;
  });

  const text = lines.join('\n');

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    throw new Error('Failed to copy to clipboard');
  }
}

/**
 * Copy quiz to clipboard
 */
export async function copyQuizToClipboard(quiz) {
  if (!quiz || quiz.length === 0) {
    throw new Error('No quiz to copy');
  }

  const lines = quiz.map((q, idx) => {
    const question = (q.question || '').replace(/\n/g, ' ');
    const choices = (q.choices || []).map((c, i) => {
      const choice = (c || '').replace(/\n/g, ' ');
      const marker = i === q.answer ? '✓' : '';
      return `  ${marker} ${choice}`.trim();
    }).join(' | ');
    return `${idx + 1}. ${question}\n${choices}`;
  });

  const text = lines.join('\n\n');

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    throw new Error('Failed to copy to clipboard');
  }
}

/**
 * Escape CSV field values
 */
function escapeCSV(field) {
  if (typeof field !== 'string') {
    field = String(field || '');
  }

  // If field contains comma, newline, or quote, wrap it in quotes
  if (field.includes(',') || field.includes('\n') || field.includes('"')) {
    return `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}

/**
 * Download file to user's computer
 */
function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open Quizlet import page in new window
 * User would paste their content there
 */
export function openQuizletImport() {
  window.open('https://quizlet.com/create', '_blank');
}

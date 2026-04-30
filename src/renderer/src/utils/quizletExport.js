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
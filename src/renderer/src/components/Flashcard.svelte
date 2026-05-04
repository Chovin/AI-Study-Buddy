<script>
  import AppButton from './AppButton.svelte';
  import CircularProgress from '@smui/circular-progress'
  import { renderMarkdown } from '../utils/markdown.js'

  let {
    flashcards = $bindable([]),
    generatingFlashcards = false,
    selectedTopic = null,
    selectedModel = '',
    difficulty = $bindable('medium'),
    copied = false,
    onGenerateFlashcards,
    onCopyToClipboard = null
  } = $props()

  let currentIndex = $state(0)
  let isFlipping = $state(false)

  function currentFlashcard() {
    return flashcards[currentIndex]
  }

  function toggleCurrentFlashcard() {
    if (!currentFlashcard() || isFlipping) return

    isFlipping = true

    setTimeout(() => {
      flashcards[currentIndex].flipped = !flashcards[currentIndex].flipped
    }, 160)

    setTimeout(() => {
      isFlipping = false
    }, 320)
  }

  function nextFlashcard() {
    if (!flashcards.length) return
    currentIndex = (currentIndex + 1) % flashcards.length
  }

  function previousFlashcard() {
    if (!flashcards.length) return
    currentIndex = (currentIndex - 1 + flashcards.length) % flashcards.length
  }
</script>

<section class="panel">
  <div class="section-header">
    <h2>Flashcards</h2>
    <p>Generate flashcards from the selected topic and its files.</p>
  </div>

  <div class="using-text">
    Using {selectedModel || 'None'}
  </div>

  <div class="controls-section">
    <div class="difficulty-selector">
      <label for="flashcard-difficulty">Difficulty:</label>

      <select id="flashcard-difficulty" bind:value={difficulty}>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
    </div>

    <div class="quiz-actions">
      <AppButton
        type="raised"
        variant="flashcards"
        label="Generate Flashcards"
        disabled={!selectedTopic || generatingFlashcards}
        onClick={onGenerateFlashcards}
      ></AppButton>

      <CircularProgress
        indeterminate
        style="height: 32px; width: 32px;"
        closed={!generatingFlashcards}
      />
    </div>
  </div>

  {#if !selectedTopic}
    <p class="helper-text">Please select a topic first.</p>
  {/if}

  {#if flashcards.length}
    <div class="export-section">
      <h2 class="export-title">Export to Quizlet</h2>

      <button class="copy-btn" onclick={onCopyToClipboard}>
        {copied ? 'Copied!' : 'Copy to Clipboard'}
      </button>
    </div>

    <div class="flashcard-carousel">
      <div class="carousel-counter">
        {currentIndex + 1} / {flashcards.length}
      </div>

      <div
        class="flashcard"
        class:flipping={isFlipping}
        onclick={toggleCurrentFlashcard}
      >
        <div class="flashcard-content markdown-content">
          {@html renderMarkdown(
            currentFlashcard()?.flipped
              ? currentFlashcard().back
              : currentFlashcard().front
          )}
        </div>
      </div>

      <div class="carousel-actions">
        <button class="nav-btn" onclick={previousFlashcard}>Previous</button>
        <button class="nav-btn" onclick={toggleCurrentFlashcard}>Flip</button>
        <button class="nav-btn" onclick={nextFlashcard}>Next</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .panel {
    width: 100%;
    max-width: none;
  }

  .section-header {
    margin-bottom: 20px;
  }

  .section-header h2 {
    margin: 0 0 6px 0;
    font-size: 28px;
  }

  .section-header p {
    margin: 0;
    color: #666;
    font-size: 14px;
  }

  .using-text {
    font-size: 12px;
    color: #666;
    margin-bottom: 12px;
  }

  .controls-section {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }

  .difficulty-selector {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .difficulty-selector label {
    font-size: 14px;
    color: #333;
  }

  .difficulty-selector select {
    padding: 8px 14px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    font-size: 14px;
    color: #333;
    cursor: pointer;
  }

  .quiz-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .generate-btn :global(button) {
    border-radius: 999px;
    border: 2px solid #ff4d2d;
    color: #ff4d2d;
    background: transparent;
    padding: 8px 22px;
    font-size: 14px;
    font-weight: 600;
    text-transform: none;
    letter-spacing: normal;
  }

  .generate-btn :global(button:hover) {
    background: #ff4d2d;
    color: #fff;
  }

  .helper-text {
    color: #666;
    font-size: 14px;
    margin-top: 12px;
  }

  .export-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 20px;
  }

  .export-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #000;
  }

  .copy-btn,
  .nav-btn {
    padding: 8px 22px;
    border: 2px solid #000;
    border-radius: 999px;
    background: #fff;
    color: #000;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .copy-btn:hover,
  .nav-btn:hover {
    background: #000;
    color: #fff;
  }

  .flashcard-carousel {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    margin-top: 20px;
    overflow: hidden;
  }

  .carousel-counter {
    font-size: 14px;
    color: #000;
  }

  .flashcard {
    width: min(100%, 900px);
    height: clamp(280px, 50vh, 520px);
    padding: clamp(16px, 3vw, 32px);
    border: 2px solid #000;
    border-radius: 20px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    cursor: pointer;
    overflow: hidden;
    transform-origin: center;
  }

  .flashcard.flipping {
    animation: flip 0.32s ease;
  }

  @keyframes flip {
    0% {
      transform: scaleX(1);
    }

    50% {
      transform: scaleX(0.05);
    }

    100% {
      transform: scaleX(1);
    }
  }

  .flashcard-content {
    width: 100%;
    max-height: 100%;
    text-align: center;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .carousel-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .markdown-content {
    font-size: clamp(14px, 1.6vw, 22px);
    line-height: 1.6;
    color: #333;
  }

  .markdown-content p {
    margin: 8px 0;
  }
</style>
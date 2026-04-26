<script>
  import Button from '@smui/button'
  import CircularProgress from '@smui/circular-progress'
  import { renderMarkdown } from '../utils/markdown.js'

  let {
    flashcards = $bindable([]),
    generatingFlashcards = false,
    selectedTopic = null,
    selectedModel = '',
    onGenerateFlashcards
  } = $props()

  function toggleFlashcard(index) {
    flashcards[index].flipped = !flashcards[index].flipped
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

  <div class="quiz-actions">
    <Button
      onclick={onGenerateFlashcards}
      disabled={!selectedTopic || generatingFlashcards}
    >
      Generate Flashcards
    </Button>

    <CircularProgress
      indeterminate
      style="height: 32px; width: 32px;"
      closed={!generatingFlashcards}
    />
  </div>

  {#if !selectedTopic}
    <p class="helper-text">Please select a topic first.</p>
  {/if}

  <div class="flashcards-grid">
    {#each flashcards as f, fi (fi)}
      <div
        class="flashcard"
        onclick={() => toggleFlashcard(fi)}
      >
        {#if f.flipped}
          <div class="flashcard-content markdown-content">
            {@html renderMarkdown(f.back)}
          </div>
        {:else}
          <div class="flashcard-content markdown-content">
            {@html renderMarkdown(f.front)}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .panel {
    max-width: 1000px;
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
    margin-bottom: 8px;
  }

  .quiz-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .helper-text {
    color: #666;
    font-size: 14px;
    margin-top: 12px;
  }

  .flashcards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
    margin-top: 20px;
  }

  .flashcard {
    min-height: 160px;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 16px;
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    box-sizing: border-box;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .flashcard:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }

  .flashcard-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 12px;
    box-sizing: border-box;
    word-wrap: break-word;
    overflow: hidden;
    text-align: center;
  }

  .markdown-content {
    font-size: 14px;
    line-height: 1.6;
    color: #333;
  }

  .markdown-content h1 {
    font-size: 24px;
    margin: 16px 0 12px 0;
    font-weight: 600;
  }

  .markdown-content h2 {
    font-size: 20px;
    margin: 14px 0 10px 0;
    font-weight: 600;
  }

  .markdown-content h3 {
    font-size: 18px;
    margin: 12px 0 8px 0;
    font-weight: 600;
  }

  .markdown-content p {
    margin: 8px 0;
  }

  .markdown-content code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
  }

  .markdown-content pre {
    background: #f4f4f4;
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .markdown-content pre code {
    background: none;
    padding: 0;
    font-size: 12px;
  }

  .markdown-content ol,
  .markdown-content ul {
    margin: 8px 0;
    padding-left: 24px;
  }

  .markdown-content li {
    margin: 4px 0;
  }

  .markdown-content strong {
    font-weight: 600;
  }

  .markdown-content em {
    font-style: italic;
  }
</style>
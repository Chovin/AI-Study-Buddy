<script>
  import { onMount } from 'svelte'

  export let selectedTopic = null

  let topics = []
  let selectedValue = ''

  export async function loadTopics() {
    topics = await window.api.getTopics()

    if (selectedTopic) {
      const match = topics.find(t => String(t.id) === String(selectedTopic.id))
      if (match) {
        selectedTopic = match
      } else {
        selectedTopic = null
      }
    }

    selectedValue = selectedTopic ? String(selectedTopic.id) : ''
  }

  onMount(async () => {
    await loadTopics()
  })

  $: selectedValue = selectedTopic ? String(selectedTopic.id) : ''

  function handleChange(event) {
    selectedValue = event.target.value
    const chosen = topics.find(t => String(t.id) === String(selectedValue))
    selectedTopic = chosen || null
  }
</script>

<div class="topic-chooser">
  <label for="topic-select">Select Topic</label>
  <select
    id="topic-select"
    value={selectedValue}
    onchange={handleChange}
  >
    <option value="">None</option>
    {#each topics as topic}
      <option value={String(topic.id)}>
        {topic.name}
      </option>
    {/each}
  </select>
</div>

<style>
  .topic-chooser {
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .topic-chooser label {
    font-size: 14px;
    color: #666;
  }

  .topic-chooser select {
    min-width: 220px;
    padding: 8px 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font: inherit;
    background: white;
  }
</style>
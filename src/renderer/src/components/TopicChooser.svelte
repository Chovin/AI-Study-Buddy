<script>
  import Select, { Option } from '@smui/select'
  import { onMount } from 'svelte'

  export let selectedTopic = null

  let topics = []
  let selectedValue = ''

  export async function loadTopics() {
    topics = await window.api.getTopics()

    if (selectedTopic) {
      const stillExists = topics.find(t => String(t.id) === String(selectedTopic.id))
      if (stillExists) {
        selectedTopic = stillExists
        selectedValue = String(stillExists.id)
      } else {
        selectedTopic = null
        selectedValue = ''
      }
    } else {
      selectedValue = ''
    }
  }

  onMount(async () => {
    await loadTopics()
  })

  $: if (selectedTopic) {
    selectedValue = String(selectedTopic.id)
  } else {
    selectedValue = ''
  }

  function handleChange() {
    const chosen = topics.find(t => String(t.id) === String(selectedValue))
    selectedTopic = chosen || null
  }
</script>

<div class="topic-chooser">
  <Select
    bind:value={selectedValue}
    label="Select Topic"
    outlined
    onchange={handleChange}
  >
    <Option value="">None</Option>
    {#each topics as topic}
      <Option value={String(topic.id)}>
        {topic.name}
      </Option>
    {/each}
  </Select>
</div>

<style>
  .topic-chooser {
    min-width: 220px;
  }
</style>
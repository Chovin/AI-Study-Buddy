<script>
  import { onMount } from 'svelte'
  import Select, { Option } from '@smui/select'

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

  function handleChange() {
    const chosen = topics.find(t => String(t.id) === String(selectedValue))
    selectedTopic = chosen || null
  }
</script>

<div class="selector-wrap">
  <div class="selector-label">Select Topic</div>

  <div class="selector-box">
    <Select
      bind:value={selectedValue}
      label=""
      variant="outlined"
      onSMUISelectChange={handleChange}
    >
      <Option value="">None</Option>
      {#each topics as topic}
        <Option value={String(topic.id)}>
          {topic.name}
        </Option>
      {/each}
    </Select>
  </div>
</div>
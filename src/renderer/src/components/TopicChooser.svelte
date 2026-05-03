<script>
  import { onMount, tick } from 'svelte'
  import Select, { Option } from '@smui/select'

  export let selectedTopic = null

  let topics = []
  let selectedValue = ''
  let refreshKey = 0

  async function fetchTopics() {
    topics = await window.api.getTopics()
  }

  function syncSelectedTopic() {
    if (selectedTopic) {
      const match = topics.find(t => String(t.id) === String(selectedTopic.id))
      selectedTopic = match || null
    }

    selectedValue = selectedTopic ? String(selectedTopic.id) : ''
  }

  export async function refreshTopics() {
    await fetchTopics()
    syncSelectedTopic()

    refreshKey += 1
    await tick()
  }

  export async function loadTopics() {
    await refreshTopics()
  }

  onMount(async () => {
    await refreshTopics()
  })

  function handleChange() {
    const chosen = topics.find(t => String(t.id) === String(selectedValue))
    selectedTopic = chosen || null
  }
</script>

<div class="selector-wrap">
  <div class="selector-label">Select Topic</div>

  <div class="selector-box">
    {#key refreshKey}
      <Select
        bind:value={selectedValue}
        label=""
        variant="outlined"
        onSMUISelectChange={handleChange}
      >
        <Option value="">None</Option>

        {#each topics as topic (topic.id)}
          <Option value={String(topic.id)}>
            {topic.name}
          </Option>
        {/each}
      </Select>
    {/key}
  </div>
</div>
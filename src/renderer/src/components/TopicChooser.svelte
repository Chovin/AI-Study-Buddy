<script>
  import Select, { Option } from '@smui/select'

  let {
    topics = [],
    selectedTopicId = $bindable(null)
  } = $props()

  let refreshKey = $state(0)
  let selectedTopicName = $state("")
  
  $effect(() => {
    if (topics.length) {
      const selectedTopic = topics.find((t) => String(t.id) == String(selectedTopicId))
      if (selectedTopicName != selectedTopic.name) {
        selectedTopicName = selectedTopic.name
          setTimeout(() => {
            refreshKey += 1
          }, 0)
      }
    }
  })
</script>

<div class="selector-wrap">
  <div class="selector-label">Select Topic</div>

  <div class="selector-box">
    {#key refreshKey}
      <Select
        bind:value={selectedTopicId}
        label=""
        variant="outlined"
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
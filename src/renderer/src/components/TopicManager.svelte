<script>
  import { onMount, createEventDispatcher, tick } from 'svelte'
  import Button from '@smui/button'
  import List, { Item } from '@smui/list'
  import IconButton from '@smui/icon-button'

  export let selectedTopic = null

  const dispatch = createEventDispatcher()

  let topics = []
  let newTopic = ''
  let editingTopicId = null
  let editingTopicName = ''
  let editInputRef = null

  async function fetchTopics() {
    topics = await window.api.getTopics()

    if (selectedTopic) {
      const updatedSelected = topics.find(topic => topic.id === selectedTopic.id)
      selectedTopic = updatedSelected || null
    }

    if (!selectedTopic && topics.length > 0) {
      selectedTopic = topics[0]
    }
  }

  function notifyTopicsUpdated() {
    dispatch('topicsUpdated')
  }

  async function createTopic() {
    const name = newTopic.trim()
    if (!name) return

    const createdTopic = await window.api.createTopic(name)
    newTopic = ''

    await fetchTopics()

    if (createdTopic?.id) {
      const found = topics.find(topic => topic.id === createdTopic.id)
      if (found) selectedTopic = found
    } else {
      const found = topics.find(topic => topic.name === name)
      if (found) selectedTopic = found
    }

    notifyTopicsUpdated()
  }

  async function startEdit(topic) {
    editingTopicId = topic.id
    editingTopicName = topic.name
    await tick()
    editInputRef?.focus()
  }

  async function saveEditTopic() {
    const name = editingTopicName.trim()
    if (!name || editingTopicId == null) return

    await window.api.updateTopic(editingTopicId, name)

    editingTopicId = null
    editingTopicName = ''

    await fetchTopics()
    notifyTopicsUpdated()
  }

  function cancelEdit() {
    editingTopicId = null
    editingTopicName = ''
  }

  async function deleteTopic(topic) {
    if (!confirm(`Are you sure you want to delete the topic "${topic.name}" and all its files?`)) {
      return
    }

    await window.api.deleteTopic(topic.id)

    if (selectedTopic?.id === topic.id) {
      selectedTopic = null
    }

    editingTopicId = null
    editingTopicName = ''

    await fetchTopics()
    notifyTopicsUpdated()
  }

  function selectTopic(topic) {
    selectedTopic = topic
  }

  async function handleEditKeyDown(event) {
    if (event.key === 'Enter') {
      await saveEditTopic()
    } else if (event.key === 'Escape') {
      cancelEdit()
    }
  }

  async function handleCreateKeyDown(event) {
    if (event.key === 'Enter') {
      await createTopic()
    }
  }

  onMount(async () => {
    await fetchTopics()
  })
</script>

<div class="topic-manager">
  <h2>Topics</h2>

  <div class="create-row">
    <div class="input-wrap">
      <label for="new-topic">New Topic</label>
      <input
        id="new-topic"
        type="text"
        bind:value={newTopic}
        on:keydown={handleCreateKeyDown}
        placeholder="Enter topic name"
      />
    </div>

    <Button onclick={createTopic} raised>Create Topic</Button>
  </div>

  <List>
    {#each topics as topic (topic.id)}
      <Item>
        {#if editingTopicId === topic.id}
          <div class="topic-row editing-row">
            <input
              type="text"
              bind:value={editingTopicName}
              on:keydown={handleEditKeyDown}
              bind:this={editInputRef}
              class="edit-input"
            />

            <IconButton onclick={saveEditTopic}>
              <span class="material-icons-outlined">save</span>
            </IconButton>

            <IconButton onclick={cancelEdit}>
              <span class="material-icons-outlined">cancel</span>
            </IconButton>
          </div>
        {:else}
          <div class="topic-row">
            <button
              type="button"
              class="topic-name"
              class:selected={selectedTopic?.id === topic.id}
              on:click={() => selectTopic(topic)}
            >
              {topic.name}
            </button>

            <div class="topic-actions">
              <IconButton onclick={() => startEdit(topic)}>
                <span class="material-icons-outlined">edit</span>
              </IconButton>

              <IconButton onclick={() => deleteTopic(topic)}>
                <span class="material-icons-outlined">delete</span>
              </IconButton>
            </div>
          </div>
        {/if}
      </Item>
    {/each}
  </List>
</div>

<style>
  .topic-manager {
    padding: 0;
  }

  .create-row {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .input-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 280px;
  }

  .input-wrap label {
    font-size: 14px;
    color: #666;
  }

  .input-wrap input,
  .edit-input {
    border: none;
    border-bottom: 1px solid #999;
    outline: none;
    padding: 8px 0;
    font: inherit;
    background: transparent;
  }

  .input-wrap input:focus,
  .edit-input:focus {
    border-bottom: 2px solid #ff5a1f;
  }

  .topic-row {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .editing-row {
    justify-content: flex-start;
  }

  .topic-name {
    border: none;
    background: transparent;
    padding: 0;
    font: inherit;
    cursor: pointer;
    text-align: left;
  }

  .topic-name.selected {
    font-weight: 600;
  }

  .topic-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>
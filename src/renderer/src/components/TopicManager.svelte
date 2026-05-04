<script>
  import { onMount, tick } from 'svelte'
  import IconButton from '@smui/icon-button'
  import { Folder, Pencil, Trash2, Check, X, CirclePlus } from 'lucide-svelte'

  let {
    selectedTopic = null,
    selectedTopicId = $bindable(null),
    topics = $bindable([])
  } = $props()

  let newTopic = $state('')
  let editingTopicId = $state(null)
  let editingTopicName = $state('')
  let editInputRef = $state(null)

  async function fetchTopics() {
    topics = await window.api.getTopics()

    if (!selectedTopic && topics.length > 0) {
      selectedTopicId = String(topics[0].id)
    }
  }

  async function createTopic() {
    const name = newTopic.trim()
    if (!name) return

    const createdTopicId = await window.api.createTopic(name)
    newTopic = ''

    await fetchTopics()

    if (createdTopicId) {
      const found = topics.find(topic => topic.id === createdTopicId)
      if (found) selectedTopicId = String(found.id)
    } else {
      const found = topics.find(topic => topic.name === name)
      if (found) selectedTopicId = String(found.id)
    }
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
  }

  function cancelEdit() {
    editingTopicId = null
    editingTopicName = ''
  }

  async function deleteTopic(topic) {
    if (!confirm(`Are you sure you want to delete "${topic.name}"?`)) return

    await window.api.deleteTopic(topic.id)

    if (selectedTopic?.id === topic.id) selectedTopicId = null

    editingTopicId = null
    editingTopicName = ''

    await fetchTopics()
  }

  function selectTopic(topic) {
    selectedTopicId = String(topic.id)
  }

  async function handleEditKeyDown(event) {
    if (event.key === 'Enter') await saveEditTopic()
    else if (event.key === 'Escape') cancelEdit()
  }

  async function handleCreateKeyDown(event) {
    if (event.key === 'Enter') await createTopic()
  }

  onMount(fetchTopics)
</script>

<div class="topic-manager">
  <div class="create-row">
    <input
      type="text"
      bind:value={newTopic}
      onkeydown={handleCreateKeyDown}
      placeholder="Add New Topic"
      class="create-input"
    />

    <button class="add-btn" onclick={createTopic} aria-label="Create Topic">
      <CirclePlus size={32} />
    </button>
  </div>

  <div class="topics-list">
    {#each topics as topic (topic.id)}
      {#if editingTopicId === topic.id}
        <div class="topic-row editing-row">
          <Folder size={22} class="folder-icon" />

          <input
            type="text"
            bind:value={editingTopicName}
            onkeydown={handleEditKeyDown}
            bind:this={editInputRef}
            class="edit-input"
          />

          <div class="topic-actions">
            <IconButton onclick={saveEditTopic}>
              <Check size={18} />
            </IconButton>

            <IconButton onclick={cancelEdit}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
      {:else}
        <div
          class="topic-row clickable-row"
          class:selected-row={selectedTopic?.id === topic.id}
          onclick={() => selectTopic(topic)}
        >
          <div class="topic-left">
            <Folder size={22} class="folder-icon" />
            <span class="topic-name">{topic.name}</span>
          </div>

          <div class="topic-actions">
            <IconButton onclick={(e) => { e.stopPropagation(); startEdit(topic) }}>
              <Pencil size={18} />
            </IconButton>

            <IconButton onclick={(e) => { e.stopPropagation(); deleteTopic(topic) }}>
              <Trash2 size={18} />
            </IconButton>
          </div>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .topic-manager {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

  .create-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
  }

  .create-input {
    flex: 1;
    height: 46px;
    border: 1.5px solid #4a4a4a;
    border-radius: 8px;
    padding: 0 14px;
    font: inherit;
  }

  .create-input:focus,
  .edit-input:focus {
    border-color: #5d80c4;
  }

  .add-btn {
    border: none;
    background: transparent;
    color: #ec5f54;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add-btn:hover {
    opacity: 0.8;
  }

  .topics-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .topic-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 8px;
    border-radius: 14px;
  }

  .topic-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .clickable-row:hover {
    background: rgba(158, 191, 185, 0.12);
  }

  .selected-row {
    background: rgba(158, 191, 185, 0.18);
  }

  .folder-icon {
    color: #5d80c4;
  }

  .topic-name {
    font-size: 18px;
  }

  .edit-input {
    flex: 1;
    height: 42px;
    border: 1.5px solid #4a4a4a;
    border-radius: 8px;
    padding: 0 12px;
  }

  .topic-actions {
    display: flex;
    gap: 2px;
  }
</style>
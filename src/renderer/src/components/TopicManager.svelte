<script>
  import { onMount } from 'svelte';
  import TextField from '@smui/textfield';
  import Button from '@smui/button';
  import List, { Item } from '@smui/list';
  import IconButton from '@smui/icon-button';


  // this file is using svelte v4
  // you can use v4 or v5, but the whole file needs 
  // to be in either one or the other
  // I like the simplicity of just making variables 
  // and them being reactive
  let topics = [];
  let newTopic = '';
  export let selectedTopic = null;
  let editingTopicId = null;
  let editingTopicName = '';
  let editInputRef = null;

  async function fetchTopics() {
    topics = await window.api.getTopics();
  }

  async function createTopic() {
    if (newTopic.trim()) {
      await window.api.createTopic(newTopic.trim());
      newTopic = '';
      await fetchTopics();
    }
  }

  async function saveEditTopic() {
    if (editingTopicName.trim()) {
      await window.api.updateTopic(editingTopicId, editingTopicName.trim());
      editingTopicId = null;
      editingTopicName = '';
      await fetchTopics();
    }
  }

  function cancelEdit() {
    editingTopicId = null;
    editingTopicName = '';
  }

  async function deleteTopic(topic) {
    if (confirm(`Are you sure you want to delete the topic "${topic.name}" and all its files?`)) {
      await window.api.deleteTopic(topic.id);
      if (selectedTopic?.id === topic.id) {
        selectedTopic = null;
      }
      await fetchTopics();
    }
  }

  async function handleKeyDown(event) {
    if (event.key === 'Enter') {
      await saveEditTopic();
    } else if (event.key === 'Escape') {
      cancelEdit();
    }
  }

  // this is a svelte v4 effect. it gets executed whenever editInputRef changes
  $: {
    editInputRef?.focus();
  }

  onMount(async () => {
    await fetchTopics();
    if (topics.length > 0) {
      selectedTopic = topics[0];
    }
  });
</script>

<div>
  <h2>Topics</h2>
  <TextField bind:value={newTopic} label="New Topic" outlined />
  <Button onclick={createTopic} raised>Create Topic</Button>

  <List>
    {#each topics as topic (topic.id)}
      <Item>
        {#if editingTopicId === topic.id}
          <TextField bind:value={editingTopicName} outlined onkeydown={handleKeyDown} bind:this={editInputRef} />
          <IconButton onclick={saveEditTopic}><span class="material-icons-outlined">save</span></IconButton>
          <IconButton onclick={cancelEdit}><span class="material-icons-outlined">cancel</span></IconButton>
        {:else}
          <span onclick={() => { selectedTopic = topic; }}>{topic.name}</span>
          <IconButton onclick={() => { editingTopicId = topic.id; editingTopicName = topic.name; focusEditInput(); }}>
            <span class="material-icons-outlined">edit</span>
          </IconButton>
          <IconButton onclick={() => deleteTopic(topic)}><span class="material-icons-outlined">delete</span></IconButton>
        {/if}
      </Item>
    {/each}
  </List>
</div>

<!-- <style>
  div {
    font-family: Arial, sans-serif;
    padding: 1rem;
  }

  h2, h3 {
    margin-bottom: 1rem;
  }

  input {
    margin: 0.5rem 0;
    padding: 0.5rem;
    font-size: 1rem;
  }

  Button {
    margin: 0.5rem 0;
  }
</style> -->
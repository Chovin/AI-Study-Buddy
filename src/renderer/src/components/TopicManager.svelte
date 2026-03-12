<script>
  import { onMount } from 'svelte';
  import TextField from '@smui/textfield';
  import Button from '@smui/button';
  import List, { Item } from '@smui/list';

  let topics = [];
  let newTopic = '';
  let selectedTopic = null;
  let files = [];

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

  async function uploadFiles(event) {
    const files = event.target.files;
    if (files[0] && selectedTopic) {
      for (let file of files) {
        // technically we should be using dialog.showOpenDialog in main/index.js
        // but this is easier
        const path = window.electron.webUtils.getPathForFile(file);
        await window.api.uploadFile(selectedTopic.id, path);
        await fetchFiles(selectedTopic.id);
      }
    }
  }

  async function fetchFiles(topicId) {
    files = await window.api.getFiles(topicId);
  }

  onMount(fetchTopics);
</script>

<div>
  <h2>Topics</h2>
  <TextField bind:value={newTopic} label="New Topic" outlined />
  <Button onclick={createTopic} raised>Create Topic</Button>

  <List>
    {#each topics as topic (topic.id)}
      <Item onclick={() => { selectedTopic = topic; fetchFiles(topic.id); }}>
        {topic.name}
      </Item>
    {/each}
  </List>

  {#if selectedTopic}
    <h3>Files in {selectedTopic.name}</h3>
    <input 
      type="file" 
      multiple
      accept=".jpg, .jpeg, .png, .docx, .doc, .docm, .pdf, .odt, .txt, .ppt, .pptx, .ppsx"
      on:change={uploadFiles} 
    />
    <List>
      {#each files as file (file.id)}
        <Item>{file.file_name}</Item>
      {/each}
    </List>
  {/if}
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
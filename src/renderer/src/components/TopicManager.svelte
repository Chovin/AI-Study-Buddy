<script>
  import { onMount } from 'svelte';
  import TextField from '@smui/textfield';
  import Button from '@smui/button';
  import List, { Item } from '@smui/list';


  // this file is using svelte v4
  // you can use v4 or v5, but the whole file needs 
  // to be in either one or the other
  // I like the simplicity of just making variables 
  // and them being reactive
  let topics = [];
  let newTopic = '';
  export let selectedTopic = null;

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

  onMount(fetchTopics);
</script>

<div>
  <h2>Topics</h2>
  <TextField bind:value={newTopic} label="New Topic" outlined />
  <Button onclick={createTopic} raised>Create Topic</Button>

  <List>
    {#each topics as topic (topic.id)}
      <!-- using onclick instead of on:click here cause Item is using svelte5 -->
      <Item onclick={() => { selectedTopic = topic; }}>
        {topic.name}
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
<script>
  import Versions from './components/Versions.svelte'
  import TopicManager from './components/TopicManager.svelte'
  import FileUploader from './components/FileUploader.svelte'
  import List, { Item } from '@smui/list';
  import LinearProgress from '@smui/linear-progress';
  import {onMount} from 'svelte'
  import 'svelte-material-ui/themes/svelte.css'

  let progress = $state(0)
  let ollamaState = $state('starting')
  let ollamaMsg = $state('Initializing...')
  let ollamaProgressMsg = $derived(
    ollamaState == 'error' ? ollamaMsg :
    (ollamaMsg + ` ${parseInt(progress*100)}%`)
  )

  let ollamaReady = $state(false);
  let selectedTopic = $state(null);
  let files = $state([]);
  $effect(async () => {
    if (selectedTopic) {
      await fetchFiles(selectedTopic.id);
    }
  })

  async function fetchFiles(topicId) {
    files = await window.api.getFiles(topicId);
  }

  onMount(() => {
    window.api.onOllamaStatus((status) => {
      ollamaState = status.state
      ollamaMsg = status.message
      progress = status.progress
    })

    window.api.onOllamaReady(() => {
      ollamaReady = true
    })
  })

  const ipcHandle = () => window.electron.ipcRenderer.send('ping')
</script>

<div class="creator">Powered by electron-vite</div>
<div class="text">
  Setting up Deepseek. 
  <span class="svelte">{ollamaReady}</span>
  <span class="svelte">{ollamaProgressMsg}</span>
</div>
<div class="progress">
  <LinearProgress {progress} closed={ollamaReady} />
</div>
<p class="tip">Please try pressing <code>F12</code> to open the devTool</p>
<div class="actions">
  <div class="action">
    <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">Documentation</a>
  </div>
  <div class="action">
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions a11y-missing-attribute-->
    <a target="_blank" rel="noreferrer" on:click={ipcHandle}>Send IPC</a>
  </div>
</div>

<TopicManager bind:selectedTopic />

{#if selectedTopic}
  <h3>Files in {selectedTopic.name}</h3>
  <FileUploader {selectedTopic} on:filesUpdated={() => fetchFiles(selectedTopic.id)} />
  <List>
    {#each files as file (file.id)}
      <Item>{file.file_name}</Item>
    {/each}
  </List>
{/if}

<Versions />

<style>
  .progress {
    width: 450px;
  }
</style>
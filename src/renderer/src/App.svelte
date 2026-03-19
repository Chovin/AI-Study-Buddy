<script>
  import Versions from './components/Versions.svelte'
  import TopicManager from './components/TopicManager.svelte'
  import FileUploader from './components/FileUploader.svelte'
  import List, { Item } from '@smui/list';
  import LinearProgress from '@smui/linear-progress';
  import Button from '@smui/button';
  import IconButton from '@smui/icon-button';
  import Select, { Option } from '@smui/select';
  import Textfield from '@smui/textfield';
  import {onMount} from 'svelte'
  import 'svelte-material-ui/themes/svelte.css'
  import 'material-icons/iconfont/material-icons.css'

  let progress = $state(0)
  let ollamaState = $state('starting')
  let ollamaMsg = $state('Initializing...')
  let ollamaProgressMsg = $derived(
    ollamaState == 'error' ? ollamaMsg :
    (ollamaMsg + ` ${parseInt(progress*100)}%`)
  )
  let tasks = $state([]);
  let ollamaReady = $state(false);
  let selectedTopic = $state(null);
  let files = $state([]);
  
  let models = $state([]);
  let selectedModel = $state('');


  let responseString = $state("");
  let question = $state("");

  $effect(async () => {
    if (selectedTopic) {
      await fetchFiles(selectedTopic.id);
    }
  })

  async function fetchFiles(topicId) {
    files = await window.api.getFiles(topicId);
  }

  async function deleteFile(fileId) {
    if (confirm('Are you sure you want to delete this file?')) {
      await window.api.deleteFile(fileId);
      await fetchFiles(selectedTopic.id);
    }
  }

  async function handleModelChange() {
    try {
      await window.api.downloadModel(selectedModel);
      alert('Model downloaded successfully');
    } catch (error) {
      alert('Error downloading model: ' + error.message);
    }
  }

  onMount(() => {
    window.api.onOllamaStatus((status) => {
      ollamaState = status.state
      ollamaMsg = status.message
      progress = status.progress
    })
    window.api.onOllamaReady(async () => {
      ollamaReady = true
      models = window.api.models
      selectedModel = Object.keys(models)[0] // default to first
    })
    window.api.onProgressUpdate((ts) => {
      console.log('update', ts)
      tasks = ts.map(([id, attrs]) => {
        attrs.percent = parseInt(attrs.progress*100)
        return {id, ...attrs}
      })
      console.log('tasks', tasks)
    })
  })

  const ipcHandle = () => window.electron.ipcRenderer.send('ping')

  const sendChat = async () => {
    console.log(question)
    if (!selectedTopic || !question.trim()) return
    console.log('chat')
    responseString = await window.electron.ipcRenderer.invoke('chat', { topicId: selectedTopic.id, fileIds: files.map(f => f.id), question })
    console.log(responseString);
  }
</script>

<div class="creator">Powered by electron-vite</div>
{#each tasks as task (task.id)}
  <div class="svelte">{task.msg}
    {#if task.error}
      <span>{task.error}</span>
    {:else}
      <span>{task.percent}%</span>
    {/if}
  </div>
  <div class="progress">
    <LinearProgress progress={task.progress} closed={task.progress==1}/>
  </div>
{/each}
<Textfield bind:value={question}></Textfield>
<Button onclick={sendChat}>Send</Button>
<div>
  <p>{responseString}</p>
</div>
{#if ollamaReady}
  <div class="model-selector">
    <Select bind:value={selectedModel} label="Select Ollama Model" on:change={handleModelChange}>
      {#each Object.keys(models) as model (model)}
        <Option value={model}>{model}</Option>
      {/each}
    </Select>
    <Button onclick={handleModelChange} raised>Download</Button>
  </div>
{/if}
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
      <Item>{file.file_name}
        <IconButton onclick={() => deleteFile(file.id)}><span class="material-icons-outlined">delete</span></IconButton>
      </Item>
    {/each}
  </List>
{/if}

<Versions />

<style>
  .progress {
    width: 450px;
  }
  .model-selector {
    margin: 20px 0;
  }
</style>
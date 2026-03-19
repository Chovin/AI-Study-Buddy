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
  import {onMount, untrack} from 'svelte'
  import 'svelte-material-ui/themes/svelte.css'
  import 'material-icons/iconfont/material-icons.css'

  let tasks = $state([]);
  let ollamaReady = $state(false);
  let selectedTopic = $state(null);
  let files = $state([]);
  
  let models = $state([]);
  // alphabetically sorted model list
  let modelList = $derived.by(() => {
    let keys = Object.keys(models);
    keys.sort();
    return keys
  })

  let modelToDownload = $state('');
  let selectedModel = $state('');
  let responseString = $state("");
  let question = $state("");

  $effect(async () => {
    if (selectedTopic) {
      await fetchFiles(selectedTopic.id);
    }
  })

  $effect(() => {
    // handle model select onchange since it wasn't triggering
    let ms = untrack(() => models)
    if (ms[modelToDownload]?.installed) {
      selectedModel = modelToDownload
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

  async function handleModelDownload() {
    let downloadingModel = modelToDownload

    try {
      let success = await window.api.downloadModel(modelToDownload);
      
      if (success) {

        if (downloadingModel === modelToDownload) {
          selectedModel = modelToDownload
        }

        alert('Model downloaded successfully');
      }
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
      models = await window.api.getModels()
      modelToDownload = Object.entries(models).find(([_, o]) => o.summarizer)[0]
      selectedModel = modelToDownload
    })
    let deleted = {}
    window.api.onProgressUpdate((ts) => {
      console.log('update', ts)
      tasks = ts.map(([id, attrs]) => {
        attrs.percent = parseInt(attrs.progress*100)

        if (attrs.status != 'running' && !deleted[id]) {
          deleted[id] = true
          setTimeout(async () => {
            await window.api.deleteProgressTask(id)
            delete deleted[id]
          }, 5000)
        }

        return {id, ...attrs}
      })
      console.log('tasks', tasks)
    })
    window.api.onModelDownloaded(async (model) => {
      models = await window.api.getModels()
    })
  })

  const ipcHandle = () => window.electron.ipcRenderer.send('ping')

  const handleChatKeyDown = async (event) => {
    if (event.key === 'Enter') {
      await sendChat()
    }
  }

  const sendChat = async () => {
    console.log(question)
    if (!selectedTopic || !question.trim()) return
    responseString = await window.electron.ipcRenderer.invoke('chat', { model: selectedModel, topicId: selectedTopic.id, fileIds: files.map(f => f.id), question })
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
    <LinearProgress progress={task.progress} closed={task.status !== 'running'}/>
  </div>
{/each}
<Textfield bind:value={question} onkeydown={handleChatKeyDown}></Textfield>
<Button onclick={sendChat}>Send</Button>
<div>
  <p>{responseString}</p>
</div>
{#if ollamaReady}
  <div class="model-selector">
    <Select bind:value={modelToDownload} label="Select Ollama Model">
      {#each modelList as model (model)}
        <Option value={model}>{model} ({models[model].size})</Option>
      {/each}
    </Select>
    {#if !models[modelToDownload]?.installed}
      <Button onclick={handleModelDownload} raised>Download</Button>
    {/if}
  </div>
  <div>Using {selectedModel}</div>
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
<script>
  import Versions from './components/Versions.svelte'
  import TopicManager from './components/TopicManager.svelte'
  import FileUploader from './components/FileUploader.svelte'
  import ModelChooser from './components/ModelChooser.svelte';
  import ProgressNotifications from './components/ProgressNotifications.svelte';
  import List, { Item } from '@smui/list';
  import Button from '@smui/button';
  import IconButton from '@smui/icon-button';
  import Textfield from '@smui/textfield';
  import CircularProgress from '@smui/circular-progress';
  import {onMount} from 'svelte'
  import 'svelte-material-ui/themes/svelte.css'
  import 'material-icons/iconfont/material-icons.css'

  let ollamaReady = $state(false);
  let selectedTopic = $state(null);
  let files = $state([]);
  
  let models = $state({});
  let selectedModel = $state('');

  let responseString = $state("");
  let question = $state("");
  let quiz = $state([]);
  let generating = $state(false)

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

  onMount(() => {
    window.api.onOllamaReady(async () => {
      models = await window.api.getModels()
      selectedModel = Object.entries(models).find(([_, o]) => o.summarizer)[0]
      ollamaReady = true
    })
    window.api.onModelDownloaded(async (model) => {
      models = await window.api.getModels()
    })
  })

  const ipcHandle = () => window.electron.ipcRenderer.send('ping')

  const handleOnProgressUpdate = (id, attrs) => {
    if (String(attrs.error).includes('soffice command was not found')) {
      if (!attrs.msg.includes('LibreOffice')) {
        attrs.msg += '. These types of files require LibreOffice.'
      }
      attrs.delay = 30_000
    }
  }

  const handleChatKeyDown = async (event) => {
    if (event.key === 'Enter') {
      await sendChat()
    }
  }

  const sendChat = async () => {
    console.log(question)
    if (!selectedTopic || !question.trim()) return
    try {
      responseString = await window.api.chat(selectedModel, selectedTopic.id, files.map(f => f.id), question)
    } catch (error) {
      responseString = error.message
      throw error
    }
    console.log(responseString);
  }

  const generateQuiz = async () => {
    if (generating) return
    generating = true
    if (!selectedTopic) throw new Error('No topic selected');
    try {
      quiz = await window.api.generateQuiz(selectedModel, selectedTopic.id, files.map(f => f.id), 10, 'hard')
    } catch (error) {
      responseString = error.message
      setTimeout(() => {
        responseString = ""
      }, 10_000)
      throw error
    } finally {
      generating = false
    }
  }


</script>

<div class="creator">Powered by electron-vite</div>
<ProgressNotifications onProgressUpdate={handleOnProgressUpdate}/>
<Textfield bind:value={question} onkeydown={handleChatKeyDown}></Textfield>
<Button onclick={sendChat}>Send</Button>
<div>
  <p>{responseString}</p>
</div>
{#if ollamaReady}
  <ModelChooser bind:models bind:selectedModel/>
{/if}
<Button onclick={generateQuiz}>Generate Quiz</Button>
<CircularProgress indeterminate style="height: 32px; width: 32px;" closed={!generating}/>
{#each quiz as q , qi (q.question) }
  <h3>{q.question}</h3>
  <form>
    {#each q.choices as c, i (c) }
      <div class={{
        answer: q.answered && q.answer == i,
        guessed: q.answered && q.guessed == i
      }} 
      on:click={() => {
        q.guessed = i; 
        q.answered = true
      }}>
        <input type="radio" 
          id={`${qi}_${i}`} 
          value={i} name={qi} 
        />
        <label for={`${qi}_${i}`}>{c}</label>
      </div>
    {/each}
  </form>
{/each}
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
  .model-selector {
    margin: 20px 0;
  }
  .answer {
    background-color: rgb(125, 222, 125);
  }
  .guessed {
    background-color: rgb(249, 112, 112);
  }
  .answer.guessed {
    background-color: rgb(125, 222, 125);
  }
</style>
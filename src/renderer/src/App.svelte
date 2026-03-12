<script>
  import Versions from './components/Versions.svelte'
  import electronLogo from './assets/electron.svg'
  import TopicManager from './components/TopicManager.svelte';
  import {onMount} from 'svelte'

  let progress = $state(0)
  let ollamaState = $state('starting')
  let ollamaMsg = $state('Initializing...')
  let ollamaProgressMsg = $derived(
    ollamaState == 'error' ? ollamaMsg :
    (ollamaMsg + ` ${parseInt(progress*100)}%`)
  )

  let ollamaReady = $state(false);

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

<img alt="logo" class="logo" src={electronLogo} />
<div class="creator">Powered by electron-vite</div>
<div class="text">
  Setting up Deepseek. 
  <span class="svelte">{ollamaReady}</span>
  <span class="svelte">{ollamaProgressMsg}</span>
</div>
<div>
  <progress max="1" value={progress}></progress>
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
<TopicManager />
<Versions />

<style>
  progress {
    width: 450px;
    height: 20px;
  }
</style>
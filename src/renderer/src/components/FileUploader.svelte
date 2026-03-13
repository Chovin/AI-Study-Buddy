<script>
  export let selectedTopic;
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  async function uploadFiles(event) {
    const files = event.target.files;
    if (files[0] && selectedTopic) {
      for (let file of files) {
        // technically we should be using dialog.showOpenDialog in main/index.js
        // but this is easier
        const path = window.electron.webUtils.getPathForFile(file);
        await window.api.uploadFile(selectedTopic.id, path);
      }
      dispatch('filesUpdated');
    }
  }
</script>

<div>
  <input 
    type="file" 
    multiple
    accept=".jpg, .jpeg, .png, .docx, .doc, .docm, .pdf, .odt, .txt, .ppt, .pptx, .ppsx"
    on:change={uploadFiles} 
  />
</div>
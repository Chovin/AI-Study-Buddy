<script>
  export let selectedTopic;
  import { createEventDispatcher } from 'svelte';
  import { Upload } from 'lucide-svelte';

  const dispatch = createEventDispatcher();
  let dragging = false;

  async function handleFiles(files) {
    if (!selectedTopic || !files?.length) return;

    for (let file of files) {
      const path = window.electron.webUtils.getPathForFile(file);
      await window.api.uploadFile(selectedTopic.id, path);
    }

    dispatch('filesUpdated');
  }

  function onDrop(event) {
    event.preventDefault();
    dragging = false;
    handleFiles(event.dataTransfer.files);
  }

  function onBrowse(event) {
    handleFiles(event.target.files);
  }
</script>

<div
  class="upload-box"
  class:dragging={dragging}
  on:dragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  on:dragleave={() => (dragging = false)}
  on:drop={onDrop}
>
  <Upload size={34} color="#5d80c4" class="upload-icon" />

  <span class="upload-text">Upload your file here or</span>

  <label class="browse-btn">
    Browse
    <input
      type="file"
      multiple
      hidden
      accept=".jpg,.jpeg,.png,.docx,.doc,.docm,.pdf,.odt,.txt,.ppt,.pptx,.ppsx"
      on:change={onBrowse}
    />
  </label>
</div>

<style>
  .upload-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    width: 100%;
    min-height: 96px;
    padding: 18px 24px;
    box-sizing: border-box;
    border: 3px dashed #5d80c4;
    border-radius: 14px;
    background: #dfe8f7;
    text-align: center;
  }

  .upload-box.dragging {
    background: #d3e0f7;
    border-color: #5f79c7;
  }

  .upload-icon {
    color: #5d80c4;
    flex-shrink: 0;
  }

  .upload-text {
    font-size: 18px;
    color: #6b625e;
  }

  .browse-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 110px;
    height: 30px;
    padding: 0 22px;
    border-radius: 999px;
    background: #5d80c4;
    color: white;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
  }

  .browse-btn:hover {
    filter: brightness(0.90);
  }
</style>
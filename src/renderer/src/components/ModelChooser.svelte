<script>
  import Select, { Option } from '@smui/select';
  import Button from '@smui/button';
  import { untrack } from "svelte";

  let {
    models = $bindable({}),
    selectedModel = $bindable(''),
    disabled = false
  } = $props();

  let modelToDownload = $state('');

  let modelList = $derived.by(() => {
    let keys = Object.keys(models);
    return keys;
  });

  $effect(() => {
    let mtd = untrack(() => modelToDownload);
    let ms = untrack(() => models);

    if (selectedModel != mtd && ms[selectedModel]?.installed) {
      modelToDownload = selectedModel;
    }
  });

  function handleModelChange() {
    if (disabled) return;

    if (models[modelToDownload]?.installed) {
      selectedModel = modelToDownload;
    }
  }

  async function handleModelDownload() {
    if (disabled || !modelToDownload) return;

    let downloadingModel = modelToDownload;

    try {
      let success = await window.api.downloadModel(modelToDownload);

      if (success) {
        if (downloadingModel === modelToDownload) {
          selectedModel = modelToDownload;
        }

        alert('Model downloaded successfully');
      }
    } catch (error) {
      alert('Error downloading model: ' + error.message);
    }
  }
</script>

<div class="model-selector" class:disabled>
  <Select
    bind:value={modelToDownload}
    label="Select Ollama Model"
    disabled={disabled}
    onSMUISelectChange={handleModelChange}
  >
    {#if modelList.length === 0}
      <Option value="" disabled>Loading models...</Option>
    {:else}
      {#each modelList as model (model)}
        <Option value={model}>
          {model} ({models[model].size})
        </Option>
      {/each}
    {/if}
  </Select>

  {#if modelToDownload && !models[modelToDownload]?.installed}
    <Button onclick={handleModelDownload} raised disabled={disabled}>
      Download
    </Button>
  {/if}
</div>

<div class="using-text">
  Using {selectedModel || 'None'}
</div>

<style>
  .model-selector {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 320px;
  }

  .using-text {
    margin-top: 4px;
    font-size: 0.9rem;
  }

  .disabled {
    opacity: 0.55;
  }

  .model-selector :global(.mdc-select) {
    min-width: 180px;
    width: 180px;
  }

  .model-selector :global(.mdc-button) {
    white-space: nowrap;
  }
</style>
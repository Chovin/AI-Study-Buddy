<script>
  import Select, { Option } from '@smui/select';
  import Button from '@smui/button';
  import { untrack } from 'svelte';

  let {
    models = $bindable({}),
    selectedModel = $bindable(''),
    disabled = false
  } = $props();

  let modelToDownload = $state('');

  let modelList = $derived.by(() => {
    return Object.keys(models);
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

<div class="selector-wrap" class:disabled>
  <div class="selector-label">Select Model</div>

  <div class="selector-box">
    <Select
      bind:value={modelToDownload}
      label=""
      variant="outlined"
      disabled={disabled}
      on:SMUISelectChange={handleModelChange}
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
</div>
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

<div class="model-wrap" class:disabled>
  <div class="model-top-label">Select Model</div>

  <div class="model-selector">
    <Select
      bind:value={modelToDownload}
      label=""
      variant="outlined"
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
</div>

<style>
.model-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-top-label {
  font-size: 11px;
  color: #666;
  margin: 0;
  line-height: 1;
}

.disabled {
  opacity: 0.55;
}

.model-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

/* width */
.model-selector :global(.mdc-select) {
  width: 220px;
}

/* main box */
.model-selector :global(.mdc-select__anchor) {
  height: 38px;
  min-height: 38px;
  padding: 0 20px 0 12px;
  border-radius: 8px;
}

/* remove notch gap completely */
.model-selector :global(.mdc-notched-outline__notch) {
  border: none !important;
  max-width: 0 !important;
  padding: 0 !important;
}

/* keep outline clean */
.model-selector :global(.mdc-notched-outline) {
  border-radius: 8px;
}

/* text */
.model-selector :global(.mdc-select__selected-text) {
  font-size: 13px;
  display: flex;
  align-items: center;
}

/* arrow spacing */
.model-selector :global(.mdc-select__dropdown-icon) {
  right: 6px;
}

.model-selector :global(.mdc-button) {
  white-space: nowrap;
}
</style>
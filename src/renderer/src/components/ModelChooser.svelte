<script>
  import Select, { Option } from '@smui/select';
  import Button from '@smui/button';

  let {
    models = $bindable({}),
    selectedModel = $bindable(''),
    disabled = false
  } = $props();

  let modelList = $derived.by(() => Object.keys(models));

  function isCloudModel(modelName) {
    return modelName?.includes('-cloud');
  }

  async function handleModelDownload() {
    if (disabled || !selectedModel) return;

    const modelName = selectedModel;

    try {
      const success = await window.api.downloadModel(modelName);

      if (success) {
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
      bind:value={selectedModel}
      label=""
      variant="outlined"
      disabled={disabled}
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

    {#if selectedModel && !models[selectedModel]?.installed && !isCloudModel(selectedModel)}
      <Button onclick={handleModelDownload} raised disabled={disabled}>
        Download
      </Button>
    {/if}
  </div>
</div>
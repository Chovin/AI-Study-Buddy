<script>
  import Select, { Option } from '@smui/select';
  import Button from '@smui/button';

  let {
    models = $bindable({}),
    selectedModel = $bindable(''),
    disabled = false
  } = $props();

<<<<<<< HEAD
  async function handleModelDownload() {
    if (disabled || !selectedModel) return;

    try {
      let success = await window.api.downloadModel(selectedModel);
=======
  let modelList = $derived.by(() => Object.keys(models));

  function isCloudModel(modelName) {
    return modelName?.includes('-cloud');
  }

  async function handleModelDownload() {
    if (disabled || !selectedModel) return;

    const modelName = selectedModel;

    try {
      const success = await window.api.downloadModel(modelName);
>>>>>>> d929177b1fcc534d563f8ca429fa2b36633ef455

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
      {#if Object.keys(models).length === 0}
        <Option value="" disabled>Loading models...</Option>
      {:else}
        {#each Object.keys(models) as model (model)}
          <Option value={model}>
            {model} ({models[model].size})
          </Option>
        {/each}
      {/if}
    </Select>

<<<<<<< HEAD
    {#if selectedModel && !models[selectedModel]?.installed}
=======
    {#if selectedModel && !models[selectedModel]?.installed && !isCloudModel(selectedModel)}
>>>>>>> d929177b1fcc534d563f8ca429fa2b36633ef455
      <Button onclick={handleModelDownload} raised disabled={disabled}>
        Download
      </Button>
    {/if}
  </div>
</div>
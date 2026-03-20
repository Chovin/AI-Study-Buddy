<script>
  import Select, { Option } from '@smui/select';
  import Button from '@smui/button';
  import { untrack } from "svelte";

  // for some reason models needs to be bindable in order for the parent to update it in here
  let { models = $bindable({}), selectedModel = $bindable('') } = $props();

  let modelToDownload = $state('');

  // alphabetically sorted model list
  let modelList = $derived.by(() => {
    let keys = Object.keys(models);
    keys.sort();
    return keys
  })

  $effect(() => {
    // handle parent changing selectedModel
    let mtd = untrack(() => modelToDownload)
    let ms = untrack(() => models)
    
    if (selectedModel != mtd && ms[selectedModel]?.installed) {
      modelToDownload = selectedModel
    }
  })

  function handleModelChange() {
    if (models[modelToDownload].installed) {
      selectedModel = modelToDownload
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

</script>

<div class="model-selector">
<Select bind:value={modelToDownload} label="Select Ollama Model" onSMUISelectChange={handleModelChange}>
    {#each modelList as model (model)}
    <Option value={model}>{model} ({models[model].size})</Option>
    {/each}
</Select>
{#if !models[modelToDownload]?.installed}
    <Button onclick={handleModelDownload} raised>Download</Button>
{/if}
</div>
<div>Using {selectedModel}</div>
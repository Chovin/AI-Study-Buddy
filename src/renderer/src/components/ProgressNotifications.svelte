<script>
  import { onMount } from 'svelte'

  let tasks = $state([]);
  let { onProgressUpdate = null } = $props()

  onMount(() => {
    let deleted = {}

    window.api.onProgressUpdate((ts) => {
      tasks = ts.map(([id, { ...attrs }]) => {
        if (attrs.progress != null) attrs.percent = parseInt(attrs.progress * 100);

        if (onProgressUpdate) onProgressUpdate(id, attrs)

        if (attrs.status != 'running' && !deleted[id]) {
          deleted[id] = true
          setTimeout(async () => {
            await window.api.deleteProgressTask(id)
            delete deleted[id]
          }, attrs.delay ?? 5000)
        }

        return { id, ...attrs }
      })
    })
  })
</script>

<div class="progress-list">
  {#each tasks as task (task.id)}
    <div class="progress-item">
      <div class="progress-text">
        <span>{task.msg}</span>

        {#if task.error}
          <pre>{task.error}</pre>
        {:else if task.progress != null}
          <span>{task.percent}%</span>
        {/if}
      </div>

      {#if task.progress != null}
        <div class="progress">
          <div class="progress-track">
            <div
              class="progress-fill"
              style={`width: ${task.percent}%`}
            ></div>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .progress-list {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    width: 100%;
  }

  .progress-item {
    width: 320px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .progress-text {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: right;
    font-size: 0.9rem;
  }

  .progress {
    width: 100%;
  }

  .progress-track {
    width: 100%;
    height: 6px;
    background: #ddd;
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #f15a24;
    transition: width 0.2s ease;
  }

  pre {
    margin: 0;
    white-space: pre-wrap;
    text-align: left;
  }
</style>
<script>
  import { onMount } from 'svelte'
  import LinearProgress from '@smui/linear-progress';

  let tasks = $state([]);
  let { onProgressUpdate = null } = $props()

  onMount(() => {
    let deleted = {}
    window.api.onProgressUpdate((ts) => {
      console.log('update', ts)
      tasks = ts.map(([id, {...attrs}]) => {
        if (attrs.progress != null) attrs.percent = parseInt(attrs.progress*100);
        
        if (onProgressUpdate) onProgressUpdate(id, attrs)

        if (attrs.status != 'running' && !deleted[id]) {
          deleted[id] = true
          setTimeout(async () => {
            await window.api.deleteProgressTask(id)
            delete deleted[id]
          }, attrs.delay ?? 5000)
        }

        return {id, ...attrs}
      })
      console.log('tasks', tasks)
    })
  })
</script>

<div>
  {#each tasks as task (task.id)}
    <div class="svelte">{task.msg}
      {#if task.error}
        <pre>{task.error}</pre>
      {:else if task.progress != null}
        <span>{task.percent}%</span>
      {/if}
    </div>
    {#if task.progress != null}
      <div class="progress">
        <LinearProgress progress={task.progress} closed={task.status !== 'running'}/>
      </div>
    {/if}
  {/each}
</div>

<style>
  .progress {
    width: 450px;
  }
</style>
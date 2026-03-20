<script>
  import { onMount } from 'svelte'
  import LinearProgress from '@smui/linear-progress';

  let tasks = $state([]);

  onMount(() => {
    let deleted = {}
    window.api.onProgressUpdate((ts) => {
      console.log('update', ts)
      tasks = ts.map(([id, attrs]) => {
        attrs.percent = parseInt(attrs.progress*100)

        if (attrs.status != 'running' && !deleted[id]) {
          deleted[id] = true
          setTimeout(async () => {
            await window.api.deleteProgressTask(id)
            delete deleted[id]
          }, 5000)
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
        <span>{task.error}</span>
      {:else}
        <span>{task.percent}%</span>
      {/if}
    </div>
    <div class="progress">
      <LinearProgress progress={task.progress} closed={task.status !== 'running'}/>
    </div>
  {/each}
</div>

<style>
  .progress {
    width: 450px;
  }
</style>
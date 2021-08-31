<script>
  import { getReadableStateStore, getReadableProgressStore } from '../../../../dist/progress-utils.esm.js';

  export let name;

  let stateStore = getReadableStateStore(name);
  let progressStore = getReadableProgressStore(name);
</script>

<div data-name={name} data-hash={$stateStore === null ? undefined : $stateStore._hash}>
  <pre>State ({name}): {JSON.stringify($stateStore, null, 2)}</pre>
  <pre>Progress ({name}): {JSON.stringify($progressStore, null, 2)}</pre>
</div>

<style>
  div {
    position: fixed;
    top: 0;
    padding: 1rem;
    background-color: black;
    color: white;
  }

  div[data-name='x'] {
    left: 0;
  }

  div[data-name='y'] {
    right: 0;
  }
</style>

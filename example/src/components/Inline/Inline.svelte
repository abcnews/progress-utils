<script>
  import { invalidate, subscribe } from '../../../../dist/progress-utils.esm.js';

  let state;
  let progress;
  let padding = 16;

  subscribe('inline', ({ type, data }) => {
    switch (type) {
      case 'state':
        state = data;
        break;
      case 'progress':
        progress = data;
        break;
      default:
        break;
    }
  }, {
    regionTop: 0.2,
    regionBottom: 0.8,
    shouldClampProgress: false
  });

  function randomisePadding() {
    padding = 8 + Math.floor(Math.random() * 16);
    invalidate();
  }
</script>

<div on:click={randomisePadding} style={`padding:${padding}px`}>
  <pre>Active: {state === null ? 'no' : 'yes'}</pre>
  <pre>Progress: {JSON.stringify(progress, null, 2)}</pre>
</div>

<style>
  div {
    background-color: black;
    color: white;
  }
</style>

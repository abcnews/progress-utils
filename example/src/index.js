import acto from '@abcnews/alternating-case-to-object';
import { getMountValue, selectMounts } from '@abcnews/mount-utils';
import External from './components/External/External.svelte';
import Inline from './components/Inline/Inline.svelte';

selectMounts('external').forEach(mountEl => {
  new External({
    target: mountEl,
    props: acto(getMountValue(mountEl))
  });
});

selectMounts('progressNAMEinline').forEach(mountEl => {
  new Inline({
    target: mountEl,
    props: {}
  });
});

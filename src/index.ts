import acto from '@abcnews/alternating-case-to-object';
import { getMountValue, selectMounts } from '@abcnews/mount-utils';
import { Mount } from '@abcnews/mount-utils';
import { StateRecord, State, Progress, Message, Subscriber, LinearScale, Group, Config } from './types';
export * from './types';

const TRACKING_VERTICAL_MARGIN_PX = 400;
const VALID_MOUNTS_SELECTOR_PATTERN = /^[a-z]([a-z0-9]+)?([A-Z]+[a-z0-9]+)?$/;
const DEFAULT_CONFIG: Partial<Config> = {
  regionTop: 0,
  regionBottom: 1,
  regionThreshold: 0.5,
  shouldClampProgress: true
};

const groups = new Map<string, Group>();

const trackingObserver: IntersectionObserver | null =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (entries, _observer) => {
          entries.forEach(entry => {
            const mount = entry.target as Mount;

            for (const group of groups.values()) {
              if (group.mounts.indexOf(mount) > -1) {
                if (entry.isIntersecting) {
                  group.trackedMounts.add(mount);
                } else {
                  group.trackedMounts.delete(mount);
                }
              }
            }
          });
        },
        {
          rootMargin: `${TRACKING_VERTICAL_MARGIN_PX}px 0px`
        }
      )
    : null;

let windowInnerHeight: number = 0;

function createLinearScale(domain: [number, number], range: [number, number], clamp: boolean = false): LinearScale {
  return (value: number) => {
    if (domain[0] === domain[1] || range[0] === range[1]) {
      return range[0];
    }

    const ratio = (range[1] - range[0]) / (domain[1] - domain[0]),
      result = range[0] + ratio * (value - domain[0]);

    return clamp ? Math.min(range[1], Math.max(range[0], result)) : result;
  };
}

function getHash(state: State) {
  return state === null ? null : state._hash;
}

function setState(name: string, state: State) {
  if (!groups.has(name)) {
    return;
  }

  const group = groups.get(name);

  if (!group || (state !== null && !group.states.has(state))) {
    return;
  }

  const previousHash = getHash(group.currentState);

  group.currentState = state;

  if (previousHash !== getHash(group.currentState)) {
    for (const subscriber of group.subscribers) {
      subscriber({ type: 'state', data: group.currentState });
    }
  }
}

export function getMountsSelector(name: string) {
  return `progressNAME${name}`;
}

export function selectProgressPoints(name: string, selector?: string) {
  return selectMounts(selector || getMountsSelector(name), { markAsUsed: false });
}

function validateConfig(config: Partial<Config>): asserts config is Config {
  const { mountsSelector, regionTop, regionBottom, regionThreshold } = config;

  if (typeof mountsSelector !== 'string' || !VALID_MOUNTS_SELECTOR_PATTERN.test(mountsSelector)) {
    throw new Error('mountsSelector should be a valid mount prefix');
  }

  if (typeof regionTop !== 'number' || typeof regionBottom !== 'number' || typeof regionThreshold !== 'number') {
    throw new Error('regionTop, regionBottom and regionThreshold should all be numbers');
  }

  if (regionTop >= regionBottom) {
    throw new Error('regionTop should be smaller than regionBottom');
  }

  if (regionThreshold < regionTop || regionThreshold > regionBottom) {
    throw new Error('regionThreshold should be within regionTop and regionBottom');
  }
}

function register(name: string, options?: Partial<Config>): Group {
  const config = {
    ...DEFAULT_CONFIG,
    mountsSelector: getMountsSelector(name),
    ...(options || {})
  };

  validateConfig(config);

  const mounts = selectProgressPoints(name, config.mountsSelector);
  const states = new Set<State>();
  const mountsStates = new Map<Mount, State>();

  mounts.forEach((mount, index) => {
    const value = getMountValue(mount);
    const { name: _name, ...stateRecord } = acto(value) as StateRecord;
    const state: State = {
      _hash: value.split(config.mountsSelector as string)[1],
      _index: index,
      ...stateRecord
    };

    states.add(state);
    mountsStates.set(mount, state);
  });

  const group: Group = {
    name,
    config,
    mounts,
    trackedMounts: new Set(),
    states,
    mountsStates,
    currentState: null,
    subscribers: new Set(),
    measurements: null,
    scales: null
  };

  groups.set(name, group);

  if (trackingObserver !== null) {
    mounts.forEach(mount => {
      trackingObserver.observe(mount);
    });
  } else {
    group.mounts.forEach(mount => group.trackedMounts.add(mount));
  }

  return group;
}

export function subscribe(name: string, subscriber: Subscriber, options?: Partial<Config>): () => void {
  if (!groups.has(name)) {
    const group = register(name, options);

    window.requestAnimationFrame(() => {
      measure(group);
      update(group, true);
    });
  }

  const group = groups.get(name) as Group;

  group.subscribers.add(subscriber);
  subscriber({ type: 'state', data: group.currentState });

  return () => group.subscribers.delete(subscriber);
}

function measure(group: Group) {
  const { config, mounts } = group;
  const { regionTop, regionBottom, regionThreshold, shouldClampProgress } = config;

  let regionTopPx = Math.round(regionTop * windowInnerHeight);
  let regionBottomPx = Math.round(regionBottom * windowInnerHeight);
  let regionThresholdPx = Math.round(regionThreshold * windowInnerHeight);

  const mountsDOMRects = new Map<Mount, DOMRect>();

  function measureMountDomRect(mount: Mount) {
    if (!mountsDOMRects.has(mount)) {
      mountsDOMRects.set(mount, mount.getBoundingClientRect());
    }
  }

  const firstMount = mounts[0];
  const lastMount = mounts[mounts.length - 1];

  measureMountDomRect(firstMount);
  measureMountDomRect(lastMount);

  const firstMountDOMRect = mountsDOMRects.get(firstMount) as DOMRect;
  const lastMountDOMRect = mountsDOMRects.get(lastMount) as DOMRect;
  const mountsRangePx = lastMountDOMRect.bottom - firstMountDOMRect.top;

  group.measurements = {
    mountsRangePx,
    regionTopPx,
    regionBottomPx,
    regionThresholdPx
  };
  group.scales = {
    region: createLinearScale([regionBottomPx, regionTopPx - mountsRangePx], [0, 1], shouldClampProgress),
    threshold: createLinearScale([regionThresholdPx, regionThresholdPx - mountsRangePx], [0, 1], shouldClampProgress)
  };
}

function measureSome(condition: (group: Group) => boolean) {
  windowInnerHeight = window.innerHeight;

  for (const group of groups.values()) {
    if (condition(group)) {
      measure(group);
    }
  }
}

function measureAllTracked() {
  measureSome(group => group.trackedMounts.size > 0);
}

function measureAll() {
  measureSome(() => true);
}

function update(group: Group, isInitial?: boolean) {
  const { currentState, measurements, mounts, mountsStates, name, scales, subscribers, trackedMounts } = group;

  if (!measurements || !scales) {
    return;
  }

  const mountsDOMRects = new Map<Mount, DOMRect>();

  function measureMountDomRect(mount: Mount) {
    if (!mountsDOMRects.has(mount)) {
      mountsDOMRects.set(mount, mount.getBoundingClientRect());
    }
  }

  const firstMount = mounts[0];

  measureMountDomRect(firstMount);

  const { top } = mountsDOMRects.get(firstMount) as DOMRect;
  const region = scales.region(top);
  const threshold = scales.threshold(top);

  for (const subscriber of subscribers) {
    subscriber({
      type: 'progress',
      data: {
        region,
        threshold
      }
    });
  }

  let state: State = null;

  for (const mount of isInitial ? mounts : [...trackedMounts.values()].reverse()) {
    const { top } = mount.getBoundingClientRect();

    if (top < measurements.regionThresholdPx) {
      state = mountsStates.get(mount) as State;
      break;
    }
  }

  if (currentState !== state) {
    setState(name, state);
  }
}

function updateSome(condition: (group: Group) => boolean) {
  for (const group of groups.values()) {
    if (condition(group)) {
      update(group);
    }
  }
}

function updateAllTracked() {
  updateSome(group => group.trackedMounts.size > 0);
}

function updateAll() {
  updateSome(() => true);
}

function measureAndUpdateAllTracked() {
  measureAllTracked();
  updateAllTracked();
}

function measureAndUpdateAll() {
  measureAll();
  updateAll();
}

let isInvalidating = false;

export function invalidate() {
  if (isInvalidating) {
    return;
  }

  isInvalidating = true;
  window.requestAnimationFrame(() => {
    isInvalidating = false;
    measureAndUpdateAllTracked();
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', updateAllTracked);
  window.addEventListener('resize', measureAndUpdateAllTracked);
  measureAndUpdateAll();
}

// Helpers (for svelte, mainly)

export function getReadableStore(name: string, options?: Partial<Config>) {
  return {
    subscribe: (subscriber: (message: Message) => void) => subscribe(name, subscriber, options)
  };
}

export function getReadableStateStore(name: string, options?: Partial<Config>) {
  return {
    subscribe: (subscriber: (state: State) => void) =>
      subscribe(
        name,
        message => {
          if (message.type === 'state') {
            subscriber(message.data);
          }
        },
        options
      )
  };
}

export function getReadableProgressStore(name: string, options?: Partial<Config>) {
  return {
    subscribe: (subscriber: (progress: Progress) => void) =>
      subscribe(
        name,
        message => {
          if (message.type === 'progress') {
            subscriber(message.data);
          }
        },
        options
      )
  };
}

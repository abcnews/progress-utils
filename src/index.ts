import acto from '@abcnews/alternating-case-to-object';
import { StateRecord, State, Progress, Message, Subscriber, LinearScale, Group, Config } from './types';

export * from './types';

const TRACKING_VERTICAL_MARGIN_PX = 400;
const DEFAULT_CONFIG: Config = {
  indicatorSelector: (name: string) => `[data-mount][id^="progressNAME${name}"]`,
  indicatorStateParser: (indicator: Element) => {
    const { name, ...stateRecord } = acto(indicator.getAttribute('id') || '') || {};

    return stateRecord as StateRecord;
  },
  indicatorStateHasher: (state: StateRecord) => JSON.stringify(state),
  regionTop: 0,
  regionBottom: 1,
  regionThreshold: 0.5,
  shouldClampProgress: true,
  shouldOptimiseIndicatorTracking: true
};
const NOOP = () => {};

const groups = new Map<string, Group>();

const trackingObserver: IntersectionObserver | null =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (entries, _observer) => {
          entries.forEach(entry => {
            const indicator = entry.target as Element;
            const trackedGroups = [...groups.values()].filter(group => group.config.shouldOptimiseIndicatorTracking);

            for (const group of trackedGroups) {
              if (group.indicators.indexOf(indicator) > -1) {
                if (entry.isIntersecting) {
                  group.trackedIndicators.add(indicator);
                } else {
                  group.trackedIndicators.delete(indicator);
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

function setState(name: string, state: State) {
  const group = groups.get(name);

  if (!group || (state !== null && !group.states.has(state))) {
    return;
  }

  group.currentState = state;

  for (const subscriber of group.subscribers) {
    subscriber({ type: 'state', data: group.currentState });
  }
}

function getIndicators(name: string, indicatorSelector: string | ((name: string) => string)) {
  return Array.from(
    document.querySelectorAll(typeof indicatorSelector === 'function' ? indicatorSelector(name) : indicatorSelector)
  );
}

function validateConfig(config: Partial<Config>): asserts config is Config {
  const {
    indicatorSelector,
    indicatorStateParser,
    indicatorStateHasher,
    regionTop,
    regionBottom,
    regionThreshold
  } = config;

  if (
    (typeof indicatorSelector !== 'string' && typeof indicatorSelector !== 'function') ||
    (typeof indicatorSelector === 'function' && typeof indicatorSelector('test') !== 'string')
  ) {
    throw new Error('indicatorSelector should be a string, or a function that returns a string');
  }

  if (typeof indicatorStateParser !== 'function') {
    throw new Error('indicatorStateParser should be a function');
  }

  if (typeof indicatorStateHasher !== 'function' || typeof indicatorStateHasher({}) !== 'string') {
    throw new Error('indicatorStateHasher should be a function that takes a state object and returns a string');
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

function register(name: string, options?: Partial<Config>): Group | null {
  const config = {
    ...DEFAULT_CONFIG,
    ...(options || {})
  };

  validateConfig(config);

  const { indicatorSelector, indicatorStateParser, indicatorStateHasher, shouldOptimiseIndicatorTracking } = config;
  const indicators = getIndicators(name, indicatorSelector);

  if (indicators.length === 0) {
    console.warn(`Cannot register group "${name}" as no indicators were found in the page`);

    return null;
  }

  const states = new Set<State>();
  const indicatorsStates = new Map<Element, State>();

  indicators.forEach((indicator, index) => {
    const stateRecord = indicatorStateParser(indicator);
    const state: State = {
      _hash: indicatorStateHasher(stateRecord),
      _index: index,
      ...stateRecord
    };

    states.add(state);
    indicatorsStates.set(indicator, state);
  });

  const group: Group = {
    name,
    config,
    indicators,
    trackedIndicators: new Set(),
    states,
    indicatorsStates,
    currentState: null,
    subscribers: new Set(),
    measurements: null,
    scales: null
  };

  groups.set(name, group);

  if (shouldOptimiseIndicatorTracking && trackingObserver !== null) {
    indicators.forEach(indicator => trackingObserver.observe(indicator));
  } else {
    indicators.forEach(indicator => group.trackedIndicators.add(indicator));
  }

  return group;
}

export function subscribe(name: string, subscriber: Subscriber, options?: Partial<Config>): () => void {
  if (!groups.has(name)) {
    const group = register(name, options);

    if (group === null) {
      return NOOP;
    }

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
  const { config, indicators } = group;
  const { regionTop, regionBottom, regionThreshold, shouldClampProgress } = config;

  let regionTopPx = Math.round(regionTop * windowInnerHeight);
  let regionBottomPx = Math.round(regionBottom * windowInnerHeight);
  let regionThresholdPx = Math.round(regionThreshold * windowInnerHeight);

  const indicatorsDOMRects = new Map<Element, DOMRect>();

  function measureIndicatorDOMRect(indicator: Element) {
    if (!indicatorsDOMRects.has(indicator)) {
      indicatorsDOMRects.set(indicator, indicator.getBoundingClientRect());
    }
  }

  const topIndicator = indicators[0];
  const bottomIndicator = indicators[indicators.length - 1];

  measureIndicatorDOMRect(topIndicator);
  measureIndicatorDOMRect(bottomIndicator);

  const topIndicatorDOMRect = indicatorsDOMRects.get(topIndicator) as DOMRect;
  const bottomIndicatorDOMRect = indicatorsDOMRects.get(bottomIndicator) as DOMRect;
  const indicatorsRangePx = bottomIndicatorDOMRect.bottom - topIndicatorDOMRect.top;

  group.measurements = {
    indicatorsRangePx,
    regionTopPx,
    regionBottomPx,
    regionThresholdPx
  };
  group.scales = {
    region: createLinearScale([regionBottomPx, regionTopPx - indicatorsRangePx], [0, 1], shouldClampProgress),
    threshold: createLinearScale(
      [regionThresholdPx, regionThresholdPx - indicatorsRangePx],
      [0, 1],
      shouldClampProgress
    )
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
  measureSome(group => group.trackedIndicators.size > 0);
}

function measureAll() {
  measureSome(() => true);
}

function update(group: Group, isInitial?: boolean) {
  const {
    currentState,
    measurements,
    indicators,
    indicatorsStates,
    name,
    scales,
    subscribers,
    trackedIndicators
  } = group;

  if (!measurements || !scales) {
    return;
  }

  const indicatorsDOMRects = new Map<Element, DOMRect>();

  function measureIndicatorDOMRect(indicator: Element) {
    if (!indicatorsDOMRects.has(indicator)) {
      indicatorsDOMRects.set(indicator, indicator.getBoundingClientRect());
    }
  }

  const topIndicator = indicators[0];

  measureIndicatorDOMRect(topIndicator);

  const { top } = indicatorsDOMRects.get(topIndicator) as DOMRect;
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
  const indicatorsOrderedBottomToTop = [...(isInitial ? indicators : trackedIndicators.values())].sort(
    (a, b) => indicators.indexOf(b) - indicators.indexOf(a)
  );

  for (const indicator of indicatorsOrderedBottomToTop) {
    const { top } = indicator.getBoundingClientRect();

    if (top < measurements.regionThresholdPx) {
      state = indicatorsStates.get(indicator) as State;
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
  updateSome(group => group.trackedIndicators.size > 0);
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

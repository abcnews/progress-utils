# progress-utils

Use any vertically distributed elements as a source of scrollytelling state.

By default, it will use `#progressNAME{name}` mount points and determine state from their alternating-case properties, but you can configure the selection and state parsing for other types of DOM node.

## Exports

### `subscribe(name: string, subscriber: Subscriber, options?: Partial<Config>): () => void`

Register a subscriber to scroll progress on a given `name`. The subscriber is called immediately (with a state message) and then again for every progress or state update.

An unsubscribe function is returned.

### `invalidate()`

Manually invalidate the progress data to force a re-measure and update for all subscribers.

### `getReadableStore(name: string, options?: Partial<Config>)`

Get a [readable store](https://svelte.dev/docs#component-format-script-4-prefix-stores-with-$-to-access-their-values-store-contract) for state and progress updates on a given `name`. This is mostly for convenient integration with Svelte.

### `getReadableStateStore(name: string, options?: Partial<Config>)`

Same as `getReadableStore` but will only subscribe to state updates.

### `getReadableProgressStore(name: string, options?: Partial<Config>)`

Same as `getReadableStore` but will only subscribe to progress updates.

## Config

The subscription functions all take an (optional) config object to modify behaviour. Available options are:

## `indicatorSelector`

A function which returns a CSS selector string for use with `document.querySelectorAll`.

**Default:** `` (name: string) => `[data-mount][id^="progressNAME${name}"]`  ``

## `indicatorStateParser`

A function which takes a DOM element and returns a state object.

**Default:** See [alternating-case-to-object](https://github.com/abcnews/alternating-case-to-object).

## `indicatorStateHasher`

A function which takes a state object and returns a serialized version.

**Default:** `JSON.stringify`

## `regionTop` & `regionBottom`

The lower and upper bounds of the window height that form the region in which elements are evaluated to generate progress and state updates.

**Defaults:** `0` & `1`

## `regionThreshold`

The vertical point in the window at which a tracked element is considered to have passed the threshold.

**Default:** `0.5`

## `shouldClampProgress`

Should progress updates be clamped to the defined range (usually `[0,1]`) or can the scale interpolate beyond the defined range.

**Default:** `true`

## shouldOptimiseIndicatorTracking

Should updates to subscribers be paused when no elements effecting the result are on screen?

**Default:** `true`

export type Config = {
  indicatorSelector: string | ((name: string) => string);
  indicatorStateParser: (indicator: Element) => StateRecord;
  indicatorStateHasher: (state: StateRecord) => string;
  regionTop: number;
  regionBottom: number;
  regionThreshold: number;
  shouldClampProgress: boolean;
  shouldOptimiseIndicatorTracking: boolean;
};

export type Value = boolean | number | string | boolean[] | number[] | string[];

export type StateRecord = Record<string, Value>;

export type State =
  | (StateRecord & {
      _hash: string;
      _index: number;
    })
  | null;

export type Progress = {
  envelope: number;
  region: number;
  threshold: number;
};

export type Message =
  | {
      type: 'state';
      data: State;
    }
  | {
      type: 'progress';
      data: Progress;
    };

export type Subscriber = (message: Message) => void;

export type Measurements = {
  indicatorsRangePx: number;
  regionRangePx: number;
  regionTopPx: number;
  regionBottomPx: number;
  regionThresholdPx: number;
} | null;

export type LinearScale = (value: number) => number;

export type Scales = {
  envelope: LinearScale;
  region: LinearScale;
  threshold: LinearScale;
} | null;

export type Group = {
  name: string;
  config: Config;
  indicators: Element[];
  trackedIndicators: Set<Element>;
  measurements: Measurements;
  scales: Scales;
  states: Set<State>;
  indicatorsStates: Map<Element, State>;
  currentState: State;
  subscribers: Set<Subscriber>;
};

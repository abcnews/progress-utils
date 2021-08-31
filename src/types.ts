import { Mount } from '@abcnews/mount-utils';

export type Config = {
  mountsSelector: string;
  regionTop: number;
  regionBottom: number;
  regionThreshold: number;
  shouldClampProgress: boolean;
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
  mountsRangePx: number;
  regionTopPx: number;
  regionBottomPx: number;
  regionThresholdPx: number;
} | null;

export type LinearScale = (value: number) => number;

export type Scales = {
  region: LinearScale;
  threshold: LinearScale;
} | null;

export type Group = {
  name: string;
  config: Config;
  mounts: Mount[];
  trackedMounts: Set<Mount>;
  measurements: Measurements;
  scales: Scales;
  states: Set<State>;
  mountsStates: Map<Mount, State>;
  currentState: State;
  subscribers: Set<Subscriber>;
};

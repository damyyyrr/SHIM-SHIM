export type EntityCollection =
  "profiles" | "routines" | "sessions" | "meals" | "activeSessions";
export type EntityPatch = {
  collection: EntityCollection;
  id: string;
  before: unknown;
  after: unknown;
};
export type ChangeSet = {
  id: string;
  profileId: string;
  label: string;
  patches: EntityPatch[];
};
export type ClientEffect = {
  type: "navigate" | "export" | "restore" | "switch_profile" | "undo";
  target?: string;
};
export type Forecast = {
  exerciseId: string;
  exercise: string;
  routine: string;
  sample: boolean;
  currentWeight: number;
  nextWeight: number;
  currentReps: number[];
  targetReps: string;
  missingReps: number | null;
  sessionsToQualify: number | null;
  sessionsUntilIncrease: number | null;
  estimatedDays: number | null;
  cadenceDays: number | null;
  observations: number;
  basis: "ready" | "observed" | "scenario" | "insufficient";
  explanation: string;
  conditions: string[];
};
export type AssistantAction = {
  id: string;
  tool: string;
  label: string;
  status: "read" | "applied" | "pending" | "undone" | "dismissed";
  change?: ChangeSet;
  effect?: ClientEffect;
  forecasts?: Forecast[];
};
export type AssistantResponse = {
  text: string;
  actions: AssistantAction[];
  model: string;
  requestId: string;
};
export type ConnectionStatus = {
  connected: boolean;
  provider?: string;
  model: string;
  models: string[];
  message: string;
};

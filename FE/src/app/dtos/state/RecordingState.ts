// FE/src/app/dtos/state/RecordingState.ts
export type RecordingState = {
  header: {stamp: {sec: number; nanosec: number}; frame_id: string};
  recording: boolean;
  lastError?: string;
  bagName?: string;
};

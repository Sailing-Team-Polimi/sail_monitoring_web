// FE/src/app/dtos/commands/ClientCommand.ts
import type { Mark } from '../mark/Mark';
import { ClientCommandType } from './ClientCommandType';
import { MethodType } from '../indicator/MethodType';
import { IndicatorType } from '../indicator/IndicatorType';
import { TestFlapCommand } from '../servo/TestFlapCommand'; // <-- IMPORT CORRETTO

export type SetMarkCommand = {
  type: ClientCommandType.SetMark;
  payload: {
    mark: Mark;
  };
};

export type StartRecordingCommand = {
  type: ClientCommandType.StartRecording;
  payload: {};
};

export type StopRecordingCommand = {
  type: ClientCommandType.StopRecording;
  payload: {};
};

export type UpdateCommand = {
  type: ClientCommandType.Update;
  payload: { indicator: IndicatorType; method: MethodType };
};

// --- TIPO RINOMINATO E AGGIORNATO ---
export type SendTestCommand = {
  type: ClientCommandType.TestCommand;
  payload: { command: TestFlapCommand };
};  

// --- UNION AGGIORNATA ---
export type ClientCommandUnion =
  | SetMarkCommand
  | StartRecordingCommand
  | StopRecordingCommand
  | UpdateCommand
  | SendTestCommand;
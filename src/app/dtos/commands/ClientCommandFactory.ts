// FE/src/app/dtos/commands/clientCommandFactory.ts
import { ClientCommandType } from './ClientCommandType';
import type {
  SetMarkCommand,
  StartRecordingCommand,
  StopRecordingCommand,
  UpdateCommand,
  SendTestCommand // <-- IMPORT CORRETTO
} from './ClientCommand';
import type { Mark } from '../mark/Mark';
import { IndicatorType } from '../indicator/IndicatorType';
import { MethodType } from '../indicator/MethodType';
import { TestFlapCommand } from '../servo/TestFlapCommand'; // <-- IMPORT CORRETTO

export const ClientCommandFactory = {
  setMark(mark: Mark): SetMarkCommand {
    return {
      type: ClientCommandType.SetMark,
      payload: { mark },
    };
  },

  startRecording(): StartRecordingCommand {
    return {
      type: ClientCommandType.StartRecording,
      payload: {},
    };
  },

  stopRecording(): StopRecordingCommand {
    return {
      type: ClientCommandType.StopRecording,
      payload: {},
    };
  },

  update(indicator: IndicatorType, method: MethodType): UpdateCommand {
    return {
      type: ClientCommandType.Update,
      payload: { indicator, method },
    };
  },

  // --- FUNZIONE CORRETTA ---
  sendTestCommand(command: TestFlapCommand): SendTestCommand {  
    return {        
      type: ClientCommandType.TestCommand,
      payload: { command }, // Usiamo la variabile 'command' che ci viene passata
    };
  }
};

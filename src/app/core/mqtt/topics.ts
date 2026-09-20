export const TOPICS = {
  dashboard: 'sail_gui/data/dashboard_data',
  map: 'sail_gui/data/map_data',
  mechatronics: 'sail_gui/data/mechatronics_data',
  indicators: 'sail_gui/data/indicators',
  recording: 'sail_gui/data/recording_state',
  setMark: 'sail_gui/cmd/set_mark',
  update: 'sail_gui/cmd/update',
  testServo: 'sail_gui/cmd/show_servo_angle',
  start: 'sail_gui/cmd/start_recording',
  stop: 'sail_gui/cmd/stop_recording',
  startResponse: 'sail_gui/rsp/start_recording',
  stopResponse: 'sail_gui/rsp/stop_recording',
} as const;

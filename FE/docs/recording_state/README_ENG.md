# Recording state

_Last updated: 01/11/2026_

[Italiano](README.md) · [Web app (Italian)](../../README.md)

The MQTT topic `sail_gui/data/recording_state` carries the ROS recorder state. The message includes a header:

```json
{
  "header": {"stamp": {"sec": 1793527200, "nanosec": 0}, "frame_id": ""},
  "recording": true,
  "bag_name": "rosbag2_example",
  "last_error": ""
}
```

The example timestamp is illustrative: a real message gets its timestamp from the recorder after checking the process. It identifies the system time of that check, not the start of recording. `frame_id` remains empty. The header travels from the Raspberry without being rewritten by the MQTT gateway.

## When state is current

In [app-config.ts](../../src/app/core/mqtt/app-config.ts), `recordingTimeoutMs: 5000` limits both age since the Raspberry check and silence since the last received update. A sample arriving 4.5 seconds late has only half a second of remaining validity, not another five seconds.

The session checks expiry every 500 ms and before sending Start or Stop. When state expires, the Mechatron panel displays **STATO NON DISPONIBILE O SCADUTO** (state unavailable or expired), turns off the recording indicator and disables both buttons. It does not infer **NOT RECORDING**: without updates, the actual state is unknown.

Messages with missing headers, zero, malformed, excessively future, expired, duplicate or out-of-order timestamps are ignored. Duplicate and old packets cannot replace newer state or renew the timeout. Initial retained messages are ignored even with recent timestamps. Command responses do not invent new state: after a response, the app waits for a sample with a timestamp newer than the last accepted one.

Disconnection clears state; a new connection must receive valid telemetry. If the broker stays connected but ROS stops, timestamp validation and timeout still expire state.

## Coordinated configuration

The recorder publishes at 2 Hz, configurable through its `publish_rate_hz`. The gateway sends nominally at 1 Hz, prioritizing changes to `recording`, `bag_name` or `last_error`. Advancing only the timestamp is not a priority change.

The ROS gateway also has `telemetry.recording_max_age_s: 5.0` in its YAML and checks age both on receipt and before MQTT transmission. When changing the web threshold, consider the gateway threshold too. Raspberry, gateway and the device opening the page must have system clocks aligned within the tolerance described below. The timestamp uses system time even with a paused simulated `/clock`: it describes the real recorder process. Historical states replayed from a rosbag do not describe the current recorder and are rejected.

Adding `std_msgs/Header` to `sail_msgs/msg/RecordingState` changes the ROS interface. Rebuild `sail_msgs`, `rosbag_manager` and `web_communication` and deploy the new web app together. Old headerless telemetry does not enable commands. Bags using the old message require conversion or the previous interfaces.

## Verification

From `FE/`:

```bash
npm test
npm run test:types
npm run build -- --base-href ./
```

Tests use a simulated MQTT client and clocks: they cover delayed samples, expiry without disconnection, duplicates, ordering, future or missing timestamps, retained messages, command responses and recovery with valid state. They do not contact the broker or boat.

## Small clock differences

`recordingClockSkewToleranceMs: 1000` in [app-config.ts](../../src/app/core/mqtt/app-config.ts) allows timestamps up to and including 1 second ahead. The matching ROS gateway parameter is `telemetry.recording_clock_skew_tolerance_s: 1.0`. Tolerance is configurable, finite, nonnegative and below the expiry threshold; zero restores strict checking.

Expiry remains 5 seconds: tolerance is **not** added to the maximum age of old messages. The timeout since the last accepted reception also prevents a slightly future timestamp from extending state beyond 5 seconds without new samples. Duplicates and out-of-order messages cannot reset that timeout. Examples: +300 ms and +1000 ms are accepted; +1001 ms and an age of 5000 ms are rejected.

Clocks should remain reasonably aligned through automatic synchronization: exact agreement is no longer required. Device clock differences are not estimated or corrected automatically. Tests cover both boundaries, configuration, expiry with future timestamps and duplicate messages failing to renew state.

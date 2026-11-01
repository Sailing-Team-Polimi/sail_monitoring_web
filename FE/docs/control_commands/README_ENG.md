# Command and indicator validity

_Last updated: 01/11/2026_

[Italiano](README.md)

The ROS PID publishes flap and servo targets as `trajectory_msgs/msg/JointTrajectory`, with one joint, one position in radians and the computation timestamp. These are not physical position measurements. `Indicators` preserves system-specific values and capabilities and adds a header with its ROS generation time.

The frontend receives these data through MQTT after aggregation. Telemetry angles remain in degrees. `flap_command_fresh`, `servo_command_fresh` and `indicators_fresh` indicate the validity of the corresponding values: receiving a new aggregate does not make every field recent. Expired fields are marked invalid, and buttons depending on indicator state are disabled.

The single JSON on `sail_gui/data/mechatronics_data` contains an aggregate `header` and `indicators` with the complete PID message and its original header. It also includes:

```json
"control_freshness": {
  "sent_at_unix_ms": 1793538000000,
  "remaining_ms": {"flap": 900, "servo": 900, "indicators": 1900}
}
```

The gateway calculates remaining lifetimes from original ROS timestamps, including replay with `/clock`; `sent_at_unix_ms` instead uses the system clock. The browser subtracts MQTT transit age, tolerates sending up to 1 s in the future for small clock offsets, and caps received validity at 5 s. Missing or invalid metadata cannot enable controls. New aggregates containing the same indicator header do not renew its expiry.

Gateway defaults are 1 s for display angles (2 Hz telemetry) and 2 s for indicators. The node sending commands to CAN keeps a separate 0.3 s limit. A flag already false in ROS telemetry remains false. Visual checks run every 500 ms; button permissions are checked again at click time. These lifetimes do not confirm that the servo has reached its commanded position.

Update ROS, gateway and frontend together. Raspberry and browser system clocks must be sufficiently aligned. `RecordingState` checking remains separate: see its [dedicated guide](../recording_state/README_ENG.md).

## Processed sensor validity

The dashboard respects `imu_fresh`, `velocity_fresh` and `wind_fresh`; mechatronics additionally uses `wand_fresh`, `height_wand_fresh` and `height_ultrasound_fresh`. Expired fields are shown as invalid while retaining the last numeric value internally. The map keeps usable GPS position visible without wind or heading: it hides invalid wind arrows and uses a nondirectional dot when IMU orientation is unavailable. Missing flags or values other than boolean `true` do not indicate validity.

`data_elaboration` recalculates these flags at a configurable 10 Hz and the gateway sends them at its existing MQTT rates. Expiry notification therefore arrives with the next telemetry update. If the entire MQTT stream stops, the page's receipt timeout remains active.

## Single channel and manual command

The session subscribes only to `sail_gui/data/mechatronics_data` for values and indicators: the old `sail_gui/data/indicators` channel is removed. Both internal UI streams update from the same packet. Packets missing an aggregate header are rejected; indicators with missing, invalid or expired headers cannot enable buttons. The gateway checks aggregate age with `telemetry.mechatronics_max_age_s: 1.0`, and indicators using their own timestamp and a 2 s limit.

The manual request retains its existing MQTT command path; in ROS `mec_elaboration_node` translates it to `/processed/manual_servo_cmd` (`ServoCmd`) with `header.stamp` assigned at that moment. The PID checks a default maximum age of 0.5 s and rejects duplicates, future timestamps and invalid types. The command is emitted once per request and is never repeated by telemetry.

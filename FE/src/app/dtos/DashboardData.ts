// FE/src/app/dtos/DashboardData.ts
import type { TimeStamp } from "./common/TimeStamp";

export interface DashboardData {
    imu_fresh?: boolean;
    velocity_fresh?: boolean;
    wind_fresh?: boolean;

    stamp: TimeStamp
    roll: number;
    pitch: number;
    yaw: number;
    sog: number; // Nodi, convertiti dai m/s del messaggio ROS nell'adattatore MQTT.
    vmg: number;
    twa: number;
    twd: number;
    tws: number;
}

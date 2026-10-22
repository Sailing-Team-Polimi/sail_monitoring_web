// FE/src/app/dtos/DashboardData.ts
import type { TimeStamp } from "./common/TimeStamp";

export interface DashboardData {
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

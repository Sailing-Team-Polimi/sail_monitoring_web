// FE/src/app/dtos/DashboardData.ts
import type { TimeStamp } from "./common/TimeStamp";

export interface DashboardData {
    stamp: TimeStamp
    roll: number;
    pitch: number;
    yaw: number;
    sog: number;
    vmg: number;
    twa: number;
    twd: number;
    tws: number;
}
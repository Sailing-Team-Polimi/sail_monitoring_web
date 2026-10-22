// FE/src/app/dtos/MapData.ts
import type { Mark } from "./mark/Mark";
import type { TimeStamp } from "./common/TimeStamp";

export interface MapData {
    stamp: TimeStamp;

    //barca
    lat: number;
    lon: number;
    yaw: number;
    twd: number;
    tws: number;
    ttl: number;
    dtl: number;
    gps_state: 0 | 1 | 2;
    position_valid: boolean;
    horizontal_stddev_m: number;
    gps_covariance_fallback: boolean;

    //boe - opzionali
    marks: Mark[];
}
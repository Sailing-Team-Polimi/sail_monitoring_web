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

    //boe - opzionali
    marks: Mark[];
}
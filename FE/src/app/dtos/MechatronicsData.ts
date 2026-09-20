// FE/src/app/dtos/MechatronicsData.ts
import type { TimeStamp } from "./common/TimeStamp";

export interface MechatronicsData {
    stamp: TimeStamp

    // COLONNA SINISTRA
    servo_limit_max: number;
    servo_limit_min: number;
    kp: number;
    ki: number;
    kd: number;

    // COLONNA CENTRALE
    current_height_est_wand: number;     
    current_height_est_ultrasound: number; 
    ultrasound_data: number;             
    height_target: number;
    flap_angle_out: number;

    // COLONNA DESTRA
    servo_angle_out: number;
    roll: number;
    pitch: number;

    wand_angle: number;
}
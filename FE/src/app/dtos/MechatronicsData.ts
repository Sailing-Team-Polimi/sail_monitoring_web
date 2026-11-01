// FE/src/app/dtos/MechatronicsData.ts
import type { TimeStamp } from "./common/TimeStamp";
import type { TripleUltrasound } from "./sensor/TripleUltrasound";

export interface MechatronicsData {
    imu_fresh?: boolean;
    wand_fresh?: boolean;
    height_wand_fresh?: boolean;
    height_ultrasound_fresh?: boolean;

    header: {stamp: TimeStamp; frame_id: string};
    indicators: unknown;

    // COLONNA SINISTRA
    servo_limit_max: number;
    servo_limit_min: number;
    kp: number;
    ki: number;
    kd: number;

    // COLONNA CENTRALE
    current_height_est_wand: number;     
    current_height_est_ultrasound: number; 
    ultrasound: TripleUltrasound | null;
    ultrasound_fresh: boolean;
    height_target: number;
    flap_angle_out: number;
    flap_command_fresh?: boolean;
    servo_command_fresh?: boolean;
    indicators_fresh?: boolean;

    // COLONNA DESTRA
    servo_angle_out: number;
    roll: number;
    pitch: number;

    wand_angle: number;
}

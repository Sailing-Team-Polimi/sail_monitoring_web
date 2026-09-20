// FE/src/app/dtos/mark/Mark.ts
import { MarkType } from "./MarkType";

export interface Mark {
  type: MarkType;
  lat: number;
  lon: number;
}
// FE/src/app/utils/marks.ts
import { Mark } from "../dtos/mark/Mark";
import { MarkType } from "../dtos/mark/MarkType";

export function getMarkOfType(
  marks: Mark[],
  type: MarkType
): Mark | undefined {
  return marks.find(m => m.type === type);
}

import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
/** Query pagination constrained to positive pages and a maximum page size. */
export class PaginationDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

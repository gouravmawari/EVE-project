import { IsNotEmpty, IsString } from 'class-validator';
/** Required name and address fields for centre create and update requests. */
export class CentreDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() address!: string;
}

import { PartialType } from '@nestjs/mapped-types';
import { CreateEntityPageDto, CreatePageFieldDto } from './create-entity-page.dto';

export class UpdateEntityPageDto extends PartialType(CreateEntityPageDto) {}

export class UpdatePageFieldDto extends PartialType(CreatePageFieldDto) {}

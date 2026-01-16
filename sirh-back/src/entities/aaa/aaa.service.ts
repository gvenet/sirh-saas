import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Aaa } from './aaa.entity';
import { CreateAaaDto } from './dto/create-aaa.dto';
import { UpdateAaaDto } from './dto/update-aaa.dto';

@Injectable()
export class AaaService {
  constructor(
    @InjectRepository(Aaa)
    private aaaRepository: Repository<Aaa>,
  ) {}

  async create(createAaaDto: CreateAaaDto): Promise<Aaa> {
    const aaa = this.aaaRepository.create(createAaaDto);
    return this.aaaRepository.save(aaa);
  }

  async findAll(): Promise<Aaa[]> {
    return this.aaaRepository.find();
  }

  async findOne(id: string): Promise<Aaa> {
    const aaa = await this.aaaRepository.findOne({
      where: { id },
    });
    if (!aaa) {
      throw new NotFoundException(`Aaa with ID ${id} not found`);
    }
    return aaa;
  }

  async update(id: string, updateAaaDto: UpdateAaaDto): Promise<Aaa> {
    await this.findOne(id);
    await this.aaaRepository.update(id, updateAaaDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const aaa = await this.findOne(id);
    await this.aaaRepository.remove(aaa);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from './skill.entity';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillService {
  constructor(
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
  ) {}

  async create(createSkillDto: CreateSkillDto): Promise<Skill> {
    const skill = this.skillRepository.create(createSkillDto);
    return this.skillRepository.save(skill);
  }

  async findAll(): Promise<Skill[]> {
    return this.skillRepository.find({ relations: ['employees'] });
  }

  async findOne(id: string): Promise<Skill> {
    const skill = await this.skillRepository.findOne({
      where: { id },
      relations: ['employees'],
    });
    if (!skill) {
      throw new NotFoundException(`Skill with ID ${id} not found`);
    }
    return skill;
  }

  async update(id: string, updateSkillDto: UpdateSkillDto): Promise<Skill> {
    await this.findOne(id);
    await this.skillRepository.update(id, updateSkillDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const skill = await this.findOne(id);
    await this.skillRepository.remove(skill);
  }
}

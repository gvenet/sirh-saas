import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Test } from './test.entity';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';

@Injectable()
export class TestService {
  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
  ) {}

  async create(createTestDto: CreateTestDto): Promise<Test> {
    const test = this.testRepository.create(createTestDto);
    return this.testRepository.save(test);
  }

  async findAll(): Promise<Test[]> {
    return this.testRepository.find();
  }

  async findOne(id: string): Promise<Test> {
    const test = await this.testRepository.findOne({ where: { id } });
    if (!test) {
      throw new NotFoundException(`Test with ID ${id} not found`);
    }
    return test;
  }

  async update(id: string, updateTestDto: UpdateTestDto): Promise<Test> {
    await this.findOne(id);
    await this.testRepository.update(id, updateTestDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const test = await this.findOne(id);
    await this.testRepository.remove(test);
  }
}

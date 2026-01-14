import { TestBed } from '@angular/core/testing';

import { Generator } from './generator';

describe('Generator', () => {
  let service: Generator;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Generator);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

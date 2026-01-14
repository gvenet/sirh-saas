import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityForm } from './entity-form';

describe('EntityForm', () => {
  let component: EntityForm;
  let fixture: ComponentFixture<EntityForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

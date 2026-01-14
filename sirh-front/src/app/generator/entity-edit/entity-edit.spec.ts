import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityEdit } from './entity-edit';

describe('EntityEdit', () => {
  let component: EntityEdit;
  let fixture: ComponentFixture<EntityEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityEdit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityList } from './entity-list';

describe('EntityList', () => {
  let component: EntityList;
  let fixture: ComponentFixture<EntityList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

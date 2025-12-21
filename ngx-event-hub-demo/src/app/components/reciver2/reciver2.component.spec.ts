import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Reciver2Component } from './reciver2.component';

describe('Reciver2Component', () => {
  let component: Reciver2Component;
  let fixture: ComponentFixture<Reciver2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reciver2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Reciver2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

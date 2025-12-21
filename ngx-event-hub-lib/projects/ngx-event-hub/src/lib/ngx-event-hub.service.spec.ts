import { TestBed } from '@angular/core/testing';

import { NgxEventHubService } from './ngx-event-hub.service';

describe('NgxEventHubService', () => {
  let service: NgxEventHubService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NgxEventHubService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ErrorMessageService {

  public message = '';

  constructor() { }
}

import {Component, OnInit} from '@angular/core';
import {ApiService} from "./services/api.service";
import * as moment from 'moment-timezone'
import {FormBuilder, FormGroup, Validators} from "@angular/forms";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  public readonly TIMESTAMP_FORMAT = 'YYYYMMDDHHmmss'
  public static readonly LOCAL_TIMEZONE = 'Europe/Berlin'

  public name: string
  public paypalAddress: string

  public form: FormGroup
  public formSubmitted = false;
  public buttonText = 'Claim price!'
  public buttonTextSubmitted = 'Sending...'

  constructor(public apiService: ApiService,
              private formBuilder: FormBuilder) {
  }

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      paypalAddress: [null, [Validators.required, Validators.email]],
      name: [null]
    })
    this.apiService.getStatus()
  }

  momentFormat(m: string, format: string = 'DD/MM/YYYY @ HH:mm:ss'): string {
    return moment.tz(m, this.TIMESTAMP_FORMAT, 'UTC').tz(AppComponent.LOCAL_TIMEZONE).format(format)
  }

  getFormattedTimestamp(timestamp: string) {
    return moment.tz(timestamp, this.TIMESTAMP_FORMAT, 'UTC').tz(AppComponent.LOCAL_TIMEZONE).format('DD/MM/YYYY @ HH:mm:ss')
  }

  getRemainingTimeMinutes(): number {
    return moment.tz(this.apiService.state?.judgementTimeToday, this.TIMESTAMP_FORMAT, 'UTC').diff(moment.tz('UTC'), 'minutes')
  }

  requestPayment() {
    if (this.form.invalid) return
    this.formSubmitted = true
    this.apiService.requestPayment({name: this.name?.trim()?.length ? this.name : 'Anonymous', paypalAddress: this.paypalAddress})
      .finally(() => setTimeout(() => {
        location.reload()
      }, 3500))
  }
}

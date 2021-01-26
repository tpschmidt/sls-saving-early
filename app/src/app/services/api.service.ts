import {Injectable} from '@angular/core'
import {HttpClient} from "@angular/common/http";
import {environment} from "../../environments/environment";
import {StateResponseDto} from "../../../../lambdas/api/src/dto/state-response.dto";
import {PaymentRequestDto} from "../../../../lambdas/api/src/dto/payment-request.dto";

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  public processing = true
  public paymentRequestProcessing = false
  public state: StateResponseDto

  constructor(private httpClient: HttpClient) {

  }

  public getStatus() {
    this.httpClient.get<StateResponseDto>(
      `${environment.backend}/state`,
      { headers: { 'x-api-key': environment.apiSecret } })
      .toPromise()
      .then((response) => {
        this.state = response
        this.processing = false
      })
  }

  public requestPayment(request: PaymentRequestDto) {
    this.paymentRequestProcessing = true
    return this.httpClient.post(
      `${environment.backend}/request-payment`,
      request,
      { headers: { 'x-api-key': environment.apiSecret } })
      .toPromise()
      .finally(() => this.paymentRequestProcessing = false)
  }


}

import { UserService } from './../user.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrenciesService } from '../currencies.service';
import * as Highcharts from 'highcharts';
import HC_stock from 'highcharts/modules/stock';
import { HttpClient } from '@angular/common/http';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { environment } from '@environment';

window.Highcharts = Highcharts;

HC_stock(Highcharts);
window.Highcharts = Highcharts;

@Component({
  selector: 'app-currency',
  templateUrl: './currency.component.html',
  styleUrls: ['./currency.component.scss'],
})
export class CurrencyComponent implements OnInit {
  pool_id: string;
  amountToTransact: number = 0.0;
  sidebarContent: string = 'buy';
  Highcharts: typeof Highcharts = Highcharts;
  chartOptions: Highcharts.Options;
  currency: PoolModel.Currency;
  dailyChange: number;
  graphDataFetched: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private currenciesService: CurrenciesService,
    private http: HttpClient,
    private currencyPipe: CurrencyPipe,
    private decimalPipe: DecimalPipe,
    private userService: UserService
  ) {}

  onAmountChange(event) {
    this.amountToTransact = event.target.value;

    this.http
      .get(`${environment.backendUrl}/history/${this.currency.ticker}EUR`)
      .subscribe((response: PoolModel.Coin) => {
        this.currency.price =
          response.history[response.history.length - 1].price;
      });
  }

  switchSidebarContent(switchTo: string) {
    this.sidebarContent = switchTo;

    // reset amountToTransact
    this.amountToTransact = 0;
  }

  redirectDashboard() {
    // forcefully refresh to update balance
    window.location.href = `/pool/${this.pool_id}/dashboard`;
  }

  doTransaction(type: string) {
    this.http
      .get(`${environment.backendUrl}/history/${this.currency.ticker}EUR`)
      .subscribe((response: PoolModel.Coin) => {
        this.currency.price =
          response.history[response.history.length - 1].price;
      });

    if (type === 'buy') {
      const amountInCurrency = this.amountToTransact / this.currency.price;
      const confirmed = confirm(
        `Are you sure you would like to purchase ${this.currencyPipe.transform(
          this.amountToTransact,
          'EUR'
        )} worth of ${
          this.currency.name
        }? You will receive about ${this.decimalPipe.transform(
          amountInCurrency,
          '1.2-8'
        )} ${this.currency.ticker}.`
      );

      if (!confirmed) return;

      // make purchase
      this.http
        .post(environment.backendUrl + '/pool/buy', {
          amount: amountInCurrency,
          pool: this.pool_id,
          ticker: this.currency.ticker,
        })
        .subscribe(({ balance_spent }: any) => {
          // remove from balance
          this.userService.addBalance(this.pool_id, -balance_spent);
          this.redirectDashboard();
        });
    } else if (type === 'sell') {
      const confirmed = confirm(
        `Are you sure you would like to sell ${this.decimalPipe.transform(
          this.amountToTransact,
          '1.2-8'
        )} ${this.currency.ticker}?`
      );

      if (!confirmed) return;

      // sell
      this.http
        .post(environment.backendUrl + '/pool/sell', {
          amount: this.amountToTransact,
          pool: this.pool_id,
          ticker: this.currency.ticker,
        })
        .subscribe(({ balance_received }: any) => {
          // add to balance
          this.userService.addBalance(this.pool_id, balance_received);
          this.redirectDashboard();
        });
    }
  }

  ngOnInit(): void {
    this.refreshData();

    setInterval(() => {
      this.refreshData();
    }, 60000);
  }

  refreshData() {
    // find pool_id
    this.route.parent.params.subscribe((params) => {
      let { id: pool } = params;
      this.pool_id = pool;
    });

    this.route.params.subscribe((params) => {
      let { name } = params;

      // nesting :/
      this.currenciesService.getCurrencies().then((currencies) => {
        this.currency = currencies.find(
          (i) => i.name.toLowerCase() === name.toLowerCase()
        );

        this.http
          .get(`${environment.backendUrl}/history/${this.currency.ticker}EUR`)
          .subscribe((response: PoolModel.Coin) => {
            this.currency.price =
              response.history[response.history.length - 1].price;
          });

        this.dailyChange = this.currency.price - this.currency.previous_price;

        this.http
          .get(`${environment.backendUrl}/history/${this.currency.ticker}EUR`)
          .subscribe((response: PoolModel.Coin) => {
            this.graphDataFetched = true;

            const history = response.history.sort((first, second) => {
              return first.date - second.date;
            });
            const data = history.map(({ date, price }) => [date, price]);
            this.chartOptions = {
              series: [
                {
                  type: 'line',
                  data,
                },
              ],
              scrollbar: {
                enabled: false,
              },
              xAxis: {
                type: 'datetime',
                gridLineWidth: 0,
                lineWidth: 0,
                tickLength: 0,
              },
              yAxis: {
                gridLineWidth: 0,
                labels: {
                  align: 'left',
                },
              },
            };
          });
      });
    });
  }
}

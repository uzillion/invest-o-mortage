import { Component, OnInit } from '@angular/core';
import Chart, { CartesianScaleTypeRegistry, ChartEvent, ScaleOptionsByType, TooltipItem, plugins } from 'chart.js/auto';
import { AnyObject } from 'chart.js/dist/types/basic';
import { _DeepPartialObject } from 'chart.js/dist/types/utils';
import { getRelativePosition } from 'chart.js/helpers';


type PaymentBreakdown = {
  interestPaid: number,
  principlePaid: number
};

type MonthlyMortgageData = {
  month: number, // 1 is JAN and 12 is DEC
  currentInterest: number,
  currentPrinciple: number,
  netPayment: number,
  totalInterest: number,
  totalPrinciple: number
}


type LinearChartScales = _DeepPartialObject<{ [key: string]: ScaleOptionsByType<keyof CartesianScaleTypeRegistry> }>

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private readonly OUTSTANDING_BALANCE: string = 'Outstanding Balance';
  private readonly PORTFOLIO_VALUE: string = 'Porfolio Value';
  private readonly TOTAL_INTEREST_PAID: string = 'Total Interest Paid';
  private posX: number = 0;
  private posY: number = 0;
  private draw: boolean = false;

  additionalPrinciple: number = 0;
  investmentProportion: number = 0;
  title = 'invest-o-mortgage';
  additionalPayment: number = 0;
  principle: number = 1000000;
  loanLength: number = 30;
  interestRate: number = 2;
  investmentStart: number = 0;
  additionalInvestment: number = 0;
  annualROI: number = 10;
  pmi: number = 150;
  chart: Chart | undefined;

  ngOnInit(): void {
    const mortgageData: MonthlyMortgageData[] = this.getMortgageData();
    const investmentData: number[] = this.getInvestmentData();
    this.chart = new Chart(document.getElementById('charts') as HTMLCanvasElement, {
      type: 'line',
      data: {
        labels: mortgageData.map(row => row.month),
        datasets: [
          {
            label: this.OUTSTANDING_BALANCE,
            yAxisID: 'y',
            xAxisID: 'x',
            data: mortgageData.map(row => this.principle - row.totalPrinciple)
          },
          {
            label: this.PORTFOLIO_VALUE,
            yAxisID: 'y',
            xAxisID: 'x',
            data: investmentData
          },
          {
            label: this.TOTAL_INTEREST_PAID,
            data: mortgageData.map(row => row.totalInterest),
            yAxisID: 'y',
            xAxisID: 'x'
          },
          // {
          //   label: 'Principle Payment',
          //   data: mortgageData.map(row => row.principle)
          // }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: this.getChartOptsScales(),
        plugins: {
          tooltip: {
            callbacks: {
              footer(tooltipItems: TooltipItem<'line'>[]) {
                return 'Month: '+ this.getActiveElements()[0].index;
              }
            }
          }
        }
      },
      plugins: [{
        id: 'corsair',
        afterEvent: (chart: Chart, { event }) => {
          const {
            chartArea: {
              top,
              bottom,
              left,
              right
            }
          } = chart;
          const {
              x,
              y
          } = event as ChartEvent;

          if (x as number < left || x as number > right || y as number < top || y as number > bottom) {
            this.posX = x || 0;
            this.posY = y || 0;
            this.draw = false

            chart.draw();
            return;
          }

          this.posX = x || 0;
          this.posY = y || 0;
          this.draw = true;

          chart.draw();
        },
        afterDatasetsDraw: (chart: Chart, _, opts: AnyObject) => {
          const {
            ctx,
            chartArea: {
              top,
              bottom,
              left,
              right
            }
          } = chart;


          if (!this.draw) {
            return;
          }

          ctx.lineWidth = 3;
          ctx.setLineDash([1, 0]);
          ctx.strokeStyle = 'grey';

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(this.posX, bottom);
          ctx.lineTo(this.posX, top);
          // ctx.moveTo(left, this.posY);
          // ctx.lineTo(right, this.posY);
          ctx.stroke();
          ctx.restore();
        }
      }]
    });
  }

  updateProportion(updateFrom?: 'principle' | 'investment'): void {
    if (updateFrom === 'principle') {
      this.additionalInvestment = this.additionalPayment - this.additionalPrinciple;
    } else if (updateFrom === 'investment') {
      this.additionalPrinciple = this.additionalPayment - this.additionalInvestment;
    }

    this.investmentProportion = ( this.additionalInvestment / this.additionalPayment ) * 100
    this.updateChart();
  }

  updateProportionValues(): void {
    this.additionalPrinciple = this.additionalPayment * ( ( 100 - this.investmentProportion ) / 100 );
    this.additionalInvestment = this.additionalPayment - this.additionalPrinciple;
    this.updateChart();
  }

  displayWith(value: number): string {
    return value + '%';
  }

  updateChart(): void {
    if (!this.chart) {
      return;
    }

    const mortgageData: MonthlyMortgageData[] = this.getMortgageData();
    const investmentData: number[] = this.getInvestmentData();
    this.chart.data.datasets = [
      {
        label: this.OUTSTANDING_BALANCE,
        yAxisID: 'y',
        xAxisID: 'x',
        data: mortgageData.map(row => this.principle - row.totalPrinciple)
      },
      {
        label: this.PORTFOLIO_VALUE,
        yAxisID: 'y',
        xAxisID: 'x',
        data: investmentData
      },
      {
        label: this.TOTAL_INTEREST_PAID,
        data: mortgageData.map(row => row.totalInterest),
        yAxisID: 'y',
        xAxisID: 'x'
      },
      // {
      //   label: 'Principle Payment',
      //   data: mortgageData.map(row => row.principle)
      // }
    ];

    this.chart.options.scales = this.getChartOptsScales();

    this.chart.update();
    this.chart.resize();
    // this.chart.destroy();
    // this.ngOnInit();
  }

  private getChartOptsScales(): LinearChartScales {
    const maxAmount: number = Math.max(
      this.principle + Math.floor(0.1 * this.principle),
      this.getInvestmentData().pop() || 0
    )
    return {
      y: {
        // type: 'logarithmic',
        min: 0,
        max: maxAmount,
        title: {
          text: 'Amount ($)',
          display: true
        }
      },
      x: {
        min: 0,
        max: (this.loanLength + Math.floor(this.loanLength * 0.25)) * 12,
        title: {
          text: 'Months',
          display: true
        }
      }
    }
  }

  private getInvestmentData(): number[] {
    let investmentData: number[] = [];
    let currentPortfolioValue: number = this.investmentStart;
    const totalNumberOfMonths: number = this.loanLength * 12;
    for (let month = 1; month <= totalNumberOfMonths; month++) {
      currentPortfolioValue += this.additionalInvestment || 0;
      currentPortfolioValue += currentPortfolioValue * ((this.annualROI || 0)/ 12/ 100);
      investmentData.push(currentPortfolioValue);
    }

    return investmentData;
  }

  private getMortgageData(): MonthlyMortgageData[] {
    const mortgageData: MonthlyMortgageData[] = [];
    let totalPrinciplePaid: number = 0;
    let totalInterestPaid: number = 0;
    let outstandingBalance: number = this.principle;
    const totalNumberOfMonths: number = this.loanLength * 12;
    for (let month: number = 1; month <= totalNumberOfMonths; month++) {
      const monthlyMortgage: PaymentBreakdown = this.getPaymentBreakdown(outstandingBalance);
      totalPrinciplePaid += monthlyMortgage.principlePaid;
      totalInterestPaid += monthlyMortgage.interestPaid;
      mortgageData.push({
        month,
        currentInterest: monthlyMortgage.interestPaid,
        currentPrinciple: monthlyMortgage.principlePaid,
        netPayment: monthlyMortgage.interestPaid + monthlyMortgage.principlePaid,
        totalInterest: totalInterestPaid,
        totalPrinciple: totalPrinciplePaid
      });
      outstandingBalance -= monthlyMortgage.principlePaid;
      if (outstandingBalance <= 0) {
        break;
      }
    }

    return mortgageData;
  }

  private getPaymentBreakdown(outstandingBalance: number): PaymentBreakdown {
    const monthlyInterest: number = this.interestRate / 12 / 100;
    const totalNumberOfMonths: number = this.loanLength * 12;
    const totalMonthlyPayment: number = this.principle * ((monthlyInterest * Math.pow((1 + monthlyInterest), totalNumberOfMonths)) / (Math.pow((1 + monthlyInterest), totalNumberOfMonths) - 1));
    const interestPaid: number = outstandingBalance * monthlyInterest;
    const principlePaid: number = totalMonthlyPayment - interestPaid + (this.additionalPrinciple || 0);

    return { interestPaid, principlePaid }
  }
}

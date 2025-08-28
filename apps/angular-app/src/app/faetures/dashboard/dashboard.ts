// apps/angular-app/src/app/dashboard/dashboard.component.ts

import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient,HttpClientModule } from '@angular/common/http';
import { Chart, ChartConfiguration, ChartOptions, ChartData, ChartType, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { interval, Subscription } from 'rxjs';


const COLORS = [
  getComputedStyle(document.documentElement).getPropertyValue('--bs-primary'),       // primary
  getComputedStyle(document.documentElement).getPropertyValue('--bs-success') ,      // success
  getComputedStyle(document.documentElement).getPropertyValue('--bs-warning'),      // warning
  getComputedStyle(document.documentElement).getPropertyValue('--bs-danger'),       // danger
  getComputedStyle(document.documentElement).getPropertyValue('--bs-info'),         // info
   // fallback/palette colors
];

const PALETTE = [
  '#0d6efd', // --app-primary
  '#198754', // --app-success
  '#ffc107', // --app-warning
  '#dc3545', // --app-danger
  '#0dcaf0', // --app-info
  '#6c757d', // --app-secondary
  '#343a40', // --app-border
  '#ffffff', // --app-text
  '#cccccc', // --app-textSecondary
  '#2d2d2d'  // --app-surface
];


Chart.register(...registerables);

interface OverviewData {
  totalSites: any;
  totalLinks: any;
  totalCountries: any;
  totalCities: any;
}

interface DistributionItem {
  label: string;
  count: number;
}

interface TimeSeriesPoint {
  period: string;
  count: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective,HttpClientModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  @ViewChild('networkCanvas') networkCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  // Analytics data
  overview: OverviewData = { totalSites: 0, totalLinks: 0, totalCountries: 0, totalCities: 0 };
  countryDistribution: DistributionItem[] = [];
  networkDistribution: DistributionItem[] = [];
  platformDistribution: DistributionItem[] = [];
  timeSeriesData: TimeSeriesPoint[] = [];

  // Chart configurations
  pieChartType: ChartType = 'doughnut';
  lineChartType: ChartType = 'line';

  // Country distribution chart
  countryChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: COLORS,
      borderColor: getComputedStyle(document.documentElement).getPropertyValue('--app-surface') || '#2d2d2d',
      borderWidth: 2
    }]
  };

  // Network distribution chart
  networkChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: COLORS,
      borderColor: getComputedStyle(document.documentElement).getPropertyValue('--app-surface') || '#2d2d2d',
      borderWidth: 2
    }]
  };

  // Time series chart
  timeSeriesChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'New Sites',
      data: [],
      borderColor: getComputedStyle(document.documentElement).getPropertyValue('--app-primary') || '#0d6efd',
      backgroundColor: 'rgba(225, 228, 232, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--app-text') || '#ffffff',
          usePointStyle: true,
          padding: 20
        }
      }
    },
    scales: {
      y: {
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--app-text') || '#ffffff' },
        grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--app-text') || '#ffffff' }
      },
      x: {
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--app-text') || '#ffffff' },
        grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--app-text') || '#ffffff' }
      }
    }
  };

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--app-text') || '#ffffff',
          usePointStyle: true,
          padding: 15
        }
      }
    }
  };

  // Real-time data
  isLoading = true;
  lastUpdated = new Date();
  apiStatus = 'online';
  private refreshSubscription?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAllData();
    // this.startAutoRefresh();
  }

  ngOnDestroy() {
    this.refreshSubscription?.unsubscribe();
  }

  async loadAllData() {
    this.isLoading = true;
    try {
      await Promise.all([
        this.loadOverview(),
        this.loadDistributions(),
        this.loadTimeSeries()
      ]);
      this.apiStatus = 'online';
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      this.apiStatus = 'offline';
    } finally {
      this.isLoading = false;
      this.lastUpdated = new Date();
    }
  }

  private async loadOverview() {
    const data = await this.http.get<OverviewData>('/api/analytics/overview').toPromise();
    console.log('Overview data:', data?.totalCities);
    
    this.overview = data!;
  }

  private async loadDistributions() {
    const [countries, networks, platforms] = await Promise.all([
      this.http.get<DistributionItem[]>('/api/analytics/distribution/countries?limit=10').toPromise(),
      this.http.get<DistributionItem[]>('/api/analytics/distribution/network').toPromise(),
      this.http.get<DistributionItem[]>('/api/analytics/distribution/platform?limit=10').toPromise()
    ]);

    this.countryDistribution = countries!;
    this.networkDistribution = networks!;
    this.platformDistribution = platforms!;

    // Update chart data
    this.updateCountryChart();
    this.updateNetworkChart();
  }

  private async loadTimeSeries() {
    const data = await this.http.get<TimeSeriesPoint[]>('/api/analytics/timeseries/sites/monthly').toPromise();
    this.timeSeriesData = data!;
    this.updateTimeSeriesChart();
  }

  private updateCountryChart() {
    this.countryChartData = {
      ...this.countryChartData,
      labels: this.countryDistribution.map(item => item.label),
      datasets: [{
        ...this.countryChartData.datasets[0],
        data: this.countryDistribution.map(item => item.count)
      }]
    };
  }

  private updateNetworkChart() {
    this.networkChartData = {
      ...this.networkChartData,
      labels: this.networkDistribution.map(item => item.label),
      datasets: [{
        ...this.networkChartData.datasets[0],
        data: this.networkDistribution.map(item => item.count)
      }]
    };
  }

  private updateTimeSeriesChart() {
    this.timeSeriesChartData = {
      ...this.timeSeriesChartData,
      labels: this.timeSeriesData.map(item => item.period),
      datasets: [{
        ...this.timeSeriesChartData.datasets[0],
        data: this.timeSeriesData.map(item => item.count)
      }]
    };
  }

  private startAutoRefresh() {
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.loadAllData();
    });
  }

  // Placeholder methods for future features
  initializeNetworkTopology() {
    // TODO: Implement Cytoscape.js network visualization
    console.log('Network topology will be implemented with Cytoscape.js');
  }

  initializeGeoMap() {
    // TODO: Implement MapLibre GL JS with PBF tiles
    console.log('Geographic map will be implemented with MapLibre GL JS');
  }

  refreshData() {
    this.loadAllData();
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AdminNavbarComponent } from '../../shared/components/admin-navbar/admin-navbar.component';

interface StatCard {
  title: string;
  value: string | number;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AdminNavbarComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  stats: StatCard[] = [
    {
      title: 'Total Users',
      value: '--',
      description: 'Registered users',
      icon: 'users',
      color: 'blue'
    },
    {
      title: 'Entities',
      value: '--',
      description: 'Generated modules',
      icon: 'database',
      color: 'purple'
    },
    {
      title: 'Admins',
      value: '--',
      description: 'Administrator accounts',
      icon: 'shield',
      color: 'red'
    },
    {
      title: 'Active Sessions',
      value: '--',
      description: 'Currently logged in',
      icon: 'activity',
      color: 'green'
    }
  ];

  constructor(
    private router: Router
  ) {}

  ngOnInit(): void {
    // TODO: Charger les statistiques réelles depuis l'API
  }
}

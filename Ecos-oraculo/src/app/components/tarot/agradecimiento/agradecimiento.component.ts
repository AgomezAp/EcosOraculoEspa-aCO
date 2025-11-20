import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { gsap } from 'gsap';
import { ParticlesComponent } from '../../../shared/particles/particles.component';

declare var anime: any;

@Component({
  selector: 'app-agradecimiento',
  imports: [ParticlesComponent],
  templateUrl: './agradecimiento.component.html',
  styleUrl: './agradecimiento.component.css',
})
export class AgradecimientoComponent {
  constructor(private router: Router) {}

  redirigir(): void {
    // Limpiar datos y redirigir
    localStorage.clear();
    this.router.navigate(['/']);
  }
  volverAlInicio() {
    // Si usas Angular Router:
    this.router.navigate(['/']);
  }
}

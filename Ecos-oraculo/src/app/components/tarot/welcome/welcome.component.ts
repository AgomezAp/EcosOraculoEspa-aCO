import {
  animate,
  keyframes,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { ParticlesComponent } from '../../../shared/particles/particles.component';
import { CardService } from '../../../services/tarot/card.service';
import { cardData } from '../../../assets/data';

@Component({
  selector: 'app-welcome',
  imports: [ParticlesComponent],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('1.5s ease-in', style({ opacity: 1 })),
      ]),
    ]),
    trigger('slideDown', [
      transition(':enter', [
        style({ transform: 'translateY(-100px)', opacity: 0 }),
        animate(
          '1s ease-out',
          style({ transform: 'translateY(0)', opacity: 1 })
        ),
      ]),
    ]),
    trigger('slideIn', [
      transition(':enter', [
        animate(
          '0.8s ease-out',
          keyframes([
            style({
              transform: 'translateX(-100px) rotate(-10deg)',
              opacity: 0,
              offset: 0,
            }),
            style({
              transform: 'translateX(20px) rotate(5deg)',
              opacity: 0.7,
              offset: 0.7,
            }),
            style({
              transform: 'translateX(0) rotate(0)',
              opacity: 1,
              offset: 1,
            }),
          ])
        ),
      ]),
    ]),
    trigger('pulse', [
      transition(':enter', [
        animate(
          '2s ease-in-out',
          keyframes([
            style({ transform: 'scale(1)', opacity: 0.5, offset: 0 }),
            style({ transform: 'scale(1.1)', opacity: 0.8, offset: 0.5 }),
            style({ transform: 'scale(1)', opacity: 0.5, offset: 1 }),
          ])
        ),
      ]),
    ]),
  ],
})
export class WelcomeComponent implements OnInit {
  cardData = cardData;
  isLoading = false;
  selectedTheme: string | null = null;

  constructor(private router: Router, private cardService: CardService) {}

  ngOnInit(): void {
    // Añadir efectos de sonido opcionales
    this.initializeAudioEffects();

    // Inicializar efectos visuales adicionales
    this.initializeVisualEffects();
  }

  /**
   * Empieza las cartas teniendo en cuenta el tema seleccionado
   * @param {string} theme - El tema seleccionado
   */
  startTarot(theme: string): void {

    this.selectedTheme = theme;
    this.isLoading = true;

    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    setTimeout(() => {
      // ✅ GUARDAR TEMA EN EL SERVICIO (además de localStorage)
      this.cardService.setTheme(theme);
      localStorage.setItem('tema', theme);

      const selectedCardData = this.cardData
        .filter((card: any) => {
          const hasDescriptions = card.descriptions[theme]?.length > 0;
          if (!hasDescriptions) {
          }
          return hasDescriptions;
        })
        .map((card: any) => ({
          ...card,
          descriptions: card.descriptions[theme],
        }));


      if (selectedCardData.length === 0) {
        alert(`No hay cartas disponibles para el tema "${theme}"`);
        this.isLoading = false;
        return;
      }

      this.cardService.setSelectedCards(selectedCardData);

      setTimeout(() => {
        this.router.navigate(['/cartas', theme]);
      }, 300);
    }, 200);
  }

  /**
   * Inicializa efectos de audio opcionales
   */
  private initializeAudioEffects(): void {
    // Puedes añadir sonidos ambientales aquí
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      // Implementar sonidos suaves si lo deseas
    } catch (e) {
    }
  }

  /**
   * Inicializa efectos visuales adicionales
   */
  private initializeVisualEffects(): void {
    // Detectar movimiento del mouse para efectos parallax
    if (window.innerWidth > 768) {
      document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        const orb = document.querySelector('.mystical-orb') as HTMLElement;
        if (orb) {
          orb.style.transform = `translate(${-50 + (x - 0.5) * 20}%, ${
            -50 + (y - 0.5) * 20
          }%)`;
        }

        const symbols = document.querySelectorAll('.symbol');
        symbols.forEach((symbol: Element, index) => {
          const element = symbol as HTMLElement;
          const speed = (index + 1) * 0.5;
          element.style.transform = `translateX(${(x - 0.5) * speed * 10}px)`;
        });
      });
    }
  }
  volverAlInicio() {
    // Si usas Angular Router:
    this.router.navigate(['/']);
  }
}

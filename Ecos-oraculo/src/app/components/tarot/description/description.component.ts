import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TextPlugin } from 'gsap/TextPlugin';
import { ParticlesComponent } from '../../../shared/particles/particles.component';
import { CardService } from '../../../services/tarot/card.service';

gsap.registerPlugin(ScrollTrigger, TextPlugin);
@Component({
  selector: 'app-description',
  imports: [CommonModule, ParticlesComponent],
  templateUrl: './description.component.html',
  styleUrl: './description.component.css',
  animations: [
    trigger('fadeIn', [
      state('void', style({ opacity: 0 })),
      transition(':enter', [animate('1s ease-in', style({ opacity: 1 }))]),
    ]),
  ],
})
export class DescriptionComponent implements OnInit, AfterViewInit, OnDestroy {
  selectedCards: any[] = [];
  descriptionsText: string = '';
  countryCode: string = '';
  phone: string = '';
  nombreCliente: string = '';
  isPaid: boolean = false;
  showPopupFlag: boolean = false;
  isLoading: boolean = false;
  private timeline: gsap.core.Timeline | null = null;
  private animations: gsap.core.Tween[] = [];

  constructor(
    private cardService: CardService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}
  volverAlInicio() {
    // Si usas Angular Router:
    this.router.navigate(['/']);
  }
  ngOnInit(): void {
    this.isLoading = true;
    this.selectedCards = this.cardService.getSelectedCards();

    if (this.selectedCards.length === 0) {
      this.router.navigate(['/']);
      return;
    }

    this.generateDescriptionText();

    // Forzar detección de cambios
    this.cdr.detectChanges();

    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges(); // Forzar actualización
    }, 1000);
  }

  private generateDescriptionText(): void {
    this.descriptionsText = this.selectedCards
      .map((card) => {
        if (card.descriptions && card.descriptions.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * card.descriptions.length
          );
          return card.descriptions[randomIndex].trim();
        }
        return null;
      })
      .filter((description) => description)
      .map((description) =>
        description.endsWith('.') ? description : description + '.'
      )
      .join('  ');
  }

  private initializeAnimations(): void {
    // Timeline principal
    this.timeline = gsap.timeline({
      defaults: { ease: 'power3.out' },
    });

    // Animar header
    this.animateHeader();

    // Animar cartas
    this.animateCards();

    // Animar descripción
    this.animateDescription();

    // Animar botón CTA
    this.animateCTA();

    // Efectos de partículas
    this.animateParticles();

    // Efectos de hover en cartas
    this.setupCardHoverEffects();
  }

  private animateHeader(): void {
    const title = document.querySelector('.main-title');
    const subtitle = document.querySelector('.subtitle');
    const divider = document.querySelector('.divider-line');

    if (title) {
      gsap.from(title, {
        duration: 1,
        y: -50,
        opacity: 0,
        scale: 0.8,
        ease: 'back.out(1.7)',
      });
    }

    if (divider) {
      gsap.from(divider, {
        duration: 1,
        width: 0,
        delay: 0.3,
        ease: 'power2.out',
      });
    }

    if (subtitle) {
      gsap.from(subtitle, {
        duration: 1,
        y: -20,
        opacity: 0,
        delay: 0.5,
      });
    }
  }

  private animateCards(): void {
    const cards = document.querySelectorAll('.card-item');

    cards.forEach((card, index) => {
      // Animación de entrada escalonada
      gsap.from(card, {
        duration: 0.8,
        y: 50,
        opacity: 0,
        rotationY: 90,
        delay: 0.8 + index * 0.2,
        ease: 'power3.out',
      });

      // Añadir efecto de levitación
      const floatAnimation = gsap.to(card, {
        y: -10,
        duration: 2 + index * 0.3,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: 1.5 + index * 0.1,
      });

      this.animations.push(floatAnimation);
    });

    // Animar el brillo de las cartas
    this.animateCardGlow();
  }

  private animateCardGlow(): void {
    const glows = document.querySelectorAll('.card-glow');

    glows.forEach((glow, index) => {
      const glowAnimation = gsap.to(glow, {
        opacity: 0.6,
        scale: 1.2,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: index * 0.3,
      });

      this.animations.push(glowAnimation);
    });
  }

  private animateDescription(): void {
    const descriptionText = document.querySelector('.description-text');
    const descriptionWrapper = document.querySelector('.description-wrapper');

    if (descriptionWrapper) {
      gsap.from(descriptionWrapper, {
        duration: 1,
        scale: 0.9,
        opacity: 0,
        delay: 1.2,
        ease: 'power2.out',
      });
    }

    if (descriptionText && this.descriptionsText) {
      // Efecto de escritura de texto
      const textAnimation = gsap.to(descriptionText, {
        duration: 2,
        text: {
          value: this.descriptionsText,
          delimiter: '',
        },
        ease: 'none',
        delay: 1.5,
      });

      this.animations.push(textAnimation);
    }

    // Animar indicadores
    this.animateIndicators();
  }

  private animateIndicators(): void {
    const indicators = document.querySelectorAll('.indicator');

    indicators.forEach((indicator, index) => {
      gsap.from(indicator, {
        duration: 0.6,
        scale: 0,
        opacity: 0,
        delay: 2 + index * 0.2,
        ease: 'back.out(1.7)',
      });

      // Añadir efecto de pulso continuo
      const pulseAnimation = gsap.to(indicator, {
        scale: 1.05,
        duration: 1 + index * 0.2,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: 2.5 + index * 0.2,
      });

      this.animations.push(pulseAnimation);
    });
  }

  private animateCTA(): void {
    const ctaButton = document.querySelector('.magical-cta');
    const ctaSubtitle = document.querySelector('.cta-subtitle');

    if (ctaButton) {
      gsap.from(ctaButton, {
        duration: 1,
        scale: 0,
        opacity: 0,
        delay: 2.5,
        ease: 'elastic.out(1, 0.5)',
      });

      // Efecto de respiración en el botón
      const breathAnimation = gsap.to(ctaButton, {
        scale: 1.05,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: 3.5,
      });

      this.animations.push(breathAnimation);
    }

    if (ctaSubtitle) {
      gsap.from(ctaSubtitle, {
        duration: 0.8,
        y: 20,
        opacity: 0,
        delay: 3,
      });
    }
  }
  private animateParticles(): void {
    const particles = document.querySelectorAll('.particle');

    particles.forEach((particle, index) => {
      const particleAnimation = gsap.to(particle, {
        x: `random(-50, 50)`,
        y: `random(-50, 50)`,
        rotation: `random(-180, 180)`,
        duration: `random(10, 20)`,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: index * 0.5,
      });

      this.animations.push(particleAnimation);
    });
  }

  private setupCardHoverEffects(): void {
    const cards = document.querySelectorAll('.card-wrapper');

    cards.forEach((card, index) => {
      const img = card.querySelector('img');
      const glow = card.querySelector('.card-glow');

      card.addEventListener('mouseenter', () => {
        // Escalar carta
        gsap.to(card, {
          scale: 1.1,
          duration: 0.3,
          ease: 'power2.out',
        });

        // Rotar ligeramente
        gsap.to(img, {
          rotationY: 10,
          duration: 0.3,
          ease: 'power2.out',
        });

        // Intensificar brillo
        if (glow) {
          gsap.to(glow, {
            opacity: 1,
            scale: 1.3,
            duration: 0.3,
          });
        }

        // Efecto en otras cartas
        this.dimOtherCards(index);
      });

      card.addEventListener('mouseleave', () => {
        // Restaurar escala
        gsap.to(card, {
          scale: 1,
          duration: 0.3,
          ease: 'power2.out',
        });

        // Restaurar rotación
        gsap.to(img, {
          rotationY: 0,
          duration: 0.3,
          ease: 'power2.out',
        });

        // Restaurar brillo
        if (glow) {
          gsap.to(glow, {
            opacity: 0.6,
            scale: 1.2,
            duration: 0.3,
          });
        }

        // Restaurar otras cartas
        this.restoreAllCards();
      });

      // Efecto de click en la carta
      card.addEventListener('click', () => {
        this.flipCard(card);
      });
    });
  }

  private dimOtherCards(activeIndex: number): void {
    const cards = document.querySelectorAll('.card-wrapper');
    cards.forEach((card, index) => {
      if (index !== activeIndex) {
        gsap.to(card, {
          opacity: 0.6,
          scale: 0.95,
          duration: 0.3,
        });
      }
    });
  }

  private restoreAllCards(): void {
    const cards = document.querySelectorAll('.card-wrapper');
    cards.forEach((card) => {
      gsap.to(card, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
      });
    });
  }

  private flipCard(card: Element): void {
    gsap.to(card, {
      rotationY: 360,
      duration: 0.8,
      ease: 'power2.inOut',
    });
  }

  // Método para obtener la posición de la carta
  getCardPosition(index: number): string {
    const positions = ['Pasado', 'Presente', 'Futuro'];
    return positions[index] || '';
  }

  // Mostrar popup mejorado con animación
  showPopup(): void {
    // Animación de salida antes de navegar
    const container = document.querySelector('.cards-container');

    if (container) {
      gsap.to(container, {
        scale: 0.9,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          this.router.navigate(['/informacion']);
        },
      });
    } else {
      this.router.navigate(['/informacion']);
    }
  }

  closePopup(): void {
    this.showPopupFlag = false;
  }

  // Efectos adicionales para mejorar la experiencia
  private createMagicalEffect(): void {
    const button = document.getElementById('call-to-action');

    if (button) {
      button.addEventListener('mouseenter', () => {
        this.createSparkles(button);
      });
    }
  }

  private createSparkles(element: HTMLElement): void {
    const sparkleCount = 5;
    const rect = element.getBoundingClientRect();

    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = document.createElement('div');
      sparkle.style.position = 'fixed';
      sparkle.style.width = '4px';
      sparkle.style.height = '4px';
      sparkle.style.background = '#FFD700';
      sparkle.style.borderRadius = '50%';
      sparkle.style.pointerEvents = 'none';
      sparkle.style.zIndex = '9999';

      const startX = rect.left + Math.random() * rect.width;
      const startY = rect.top + Math.random() * rect.height;

      sparkle.style.left = startX + 'px';
      sparkle.style.top = startY + 'px';

      document.body.appendChild(sparkle);

      gsap.to(sparkle, {
        x: `random(-100, 100)`,
        y: `random(-100, 100)`,
        opacity: 0,
        duration: 1,
        ease: 'power2.out',
        onComplete: () => sparkle.remove(),
      });
    }
  }

  // Método para animar el scroll del texto de descripción
  private animateDescriptionScroll(): void {
    const scrollContainer = document.querySelector('.scrollable-description');

    if (scrollContainer) {
      ScrollTrigger.create({
        trigger: scrollContainer,
        start: 'top center',
        end: 'bottom center',
        onEnter: () => {
          gsap.to(scrollContainer, {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            duration: 0.5,
          });
        },
        onLeave: () => {
          gsap.to(scrollContainer, {
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            duration: 0.5,
          });
        },
      });
    }
  }

  // Efecto de paralaje en el fondo
  private setupParallaxEffect(): void {
    if (window.innerWidth > 768) {
      document.addEventListener('mousemove', (e) => {
        const mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        const mouseY = (e.clientY / window.innerHeight - 0.5) * 2;

        // Mover orbes flotantes
        const orbs = document.querySelectorAll('.orb');
        orbs.forEach((orb, index) => {
          gsap.to(orb, {
            x: mouseX * (20 + index * 10),
            y: mouseY * (20 + index * 10),
            duration: 1 + index * 0.2,
            ease: 'power2.out',
          });
        });

        // Mover contenedor ligeramente
        const container = document.querySelector('.cards-container');
        if (container) {
          gsap.to(container, {
            x: -mouseX * 10,
            y: -mouseY * 10,
            duration: 1,
            ease: 'power2.out',
          });
        }
      });
    }
  }

  // Método para dispositivos móviles
  private setupMobileInteractions(): void {
    if ('ontouchstart' in window) {
      const cards = document.querySelectorAll('.card-wrapper');

      cards.forEach((card) => {
        card.addEventListener('touchstart', () => {
          gsap.to(card, {
            scale: 1.05,
            duration: 0.2,
          });
        });

        card.addEventListener('touchend', () => {
          gsap.to(card, {
            scale: 1,
            duration: 0.2,
          });
        });
      });
    }
  }

  // Método para manejar orientación del dispositivo
  private handleDeviceOrientation(): void {
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        const beta = e.beta; // Inclinación adelante/atrás
        const gamma = e.gamma; // Inclinación izquierda/derecha

        if (beta !== null && gamma !== null) {
          const container = document.querySelector('.cards-container');
          if (container) {
            gsap.to(container, {
              rotationY: gamma * 0.5,
              rotationX: beta * 0.5,
              duration: 0.5,
              ease: 'power2.out',
            });
          }
        }
      });
    }
  }

  // Inicialización completa con todos los efectos
  ngAfterViewInit(): void {
    // Asegurar que el botón sea visible después del render
    setTimeout(() => {
      this.ensureButtonVisibility();
      this.initializeAnimations();
      this.createMagicalEffect();
      this.animateDescriptionScroll();
      this.setupParallaxEffect();
      this.setupMobileInteractions();
      this.handleDeviceOrientation();
      this.playEntryAnimation();
    }, 100);
  }
  private ensureButtonVisibility(): void {
    const button = document.getElementById('call-to-action');
    if (button) {
      button.style.opacity = '1';
      button.style.visibility = 'visible';
      button.style.display = 'flex';
    }

    const actionSection = document.querySelector('.action-section');
    if (actionSection) {
      (actionSection as HTMLElement).style.opacity = '1';
      (actionSection as HTMLElement).style.visibility = 'visible';
    }
  }
  private playEntryAnimation(): void {
    const masterTimeline = gsap.timeline();

    // Fade in del contenedor principal
    masterTimeline.to('.cards-container', {
      duration: 1,
      scale: 1,
      opacity: 1,
      ease: 'power3.out',
    });

    // Animación de las cartas en cascada
    masterTimeline.from(
      '.card-item',
      {
        duration: 0.6,
        scale: 0,
        rotation: -180,
        stagger: 0.2,
        ease: 'back.out(1.7)',
      },
      '-=0.5'
    );

    // Animación del contenido de descripción
    masterTimeline.from(
      '.description-wrapper',
      {
        duration: 0.8,
        y: 50,
        opacity: 0,
        ease: 'power2.out',
      },
      '-=0.3'
    );

    // Animación del botón CTA
    masterTimeline.from(
      '.magical-cta',
      {
        duration: 0.6,
        scale: 0,
        rotation: 360,
        ease: 'elastic.out(1, 0.5)',
      },
      '-=0.2'
    );
  }

  // Limpieza al destruir el componente
  ngOnDestroy(): void {
    // Limpiar timeline principal
    if (this.timeline) {
      this.timeline.kill();
    }

    // Limpiar todas las animaciones
    this.animations.forEach((anim) => {
      if (anim) anim.kill();
    });

    // Limpiar ScrollTriggers
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());

    // Remover event listeners
    document.removeEventListener('mousemove', () => {});
    window.removeEventListener('deviceorientation', () => {});
  }
}

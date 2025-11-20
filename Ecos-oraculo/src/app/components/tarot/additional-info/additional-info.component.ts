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
  OnInit,
} from '@angular/core';
import { gsap } from 'gsap';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ParticlesComponent } from '../../../shared/particles/particles.component';
import { DatosService } from '../../../services/tarot/datos.service';

@Component({
  selector: 'app-additional-info',
  imports: [ParticlesComponent, FormsModule, CommonModule],
  templateUrl: './additional-info.component.html',
  styleUrl: './additional-info.component.css',
  animations: [
    trigger('fadeIn', [
      state('void', style({ opacity: 0, transform: 'scale(0.9)' })),
      transition(':enter', [
        animate('0.8s ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
    ]),
  ],
})
export class AdditionalInfoComponent implements OnInit, AfterViewInit {
  countryCode: string = '';
  phone: string = '';
  nombreCliente: string = '';
  descriptionsText: string = '';
  selectedCards: any[] = [];
  termsAccepted: boolean = false;
  private encryptionKey = 'U0qQ0TGufDDJqCNvQS0b795q8EZPAp9E';
  tema = localStorage.getItem('tema');
  recopila: any[] = [];
  Nombre: string = '';
  telefono: string = '';
  pais: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private datosService: DatosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const recopilaData = localStorage.getItem('selectedCards');

    if (recopilaData) {
      this.recopila = JSON.parse(recopilaData);
    }
  }
  volverAlInicio() {
    // Si usas Angular Router:
    this.router.navigate(['/']);
  }
  ngAfterViewInit(): void {
    // Verificar que GSAP esté disponible
    if (typeof gsap !== 'undefined') {
      this.initializeEntryAnimations();
      this.setupInteractiveEffects();
      this.animateFormElements();
      this.setupMagicalEffects();
    } else {
      // Usar animaciones CSS como fallback
      this.applyFallbackAnimations();
    }
  }
  private applyFallbackAnimations(): void {
    // Aplicar clases CSS para animaciones como fallback
    const card = document.querySelector('.magical-card');
    if (card) {
      card.classList.add('animate-entry');
    }
  }
  private initializeEntryAnimations(): void {
    // Verificar que los elementos existan antes de animar
    const card = document.querySelector('.magical-card');
    if (!card) return;

    gsap
      .timeline()
      .from('.magical-card', {
        duration: 0.8,
        scale: 0.8,
        opacity: 0,
        ease: 'back.out(1.7)',
      })
      .from(
        '.card-header',
        {
          duration: 0.6,
          y: -30,
          opacity: 0,
          ease: 'power3.out',
        },
        '-=0.4'
      )
      .from(
        '.intro-text',
        {
          duration: 0.6,
          y: 20,
          opacity: 0,
          ease: 'power3.out',
        },
        '-=0.3'
      )
      .from(
        '.magical-input',
        {
          duration: 0.5,
          x: -30,
          opacity: 0,
          stagger: 0.1,
          ease: 'power3.out',
        },
        '-=0.2'
      );

    // Animar el botón por separado para evitar errores
    const button = document.querySelector('.magical-submit-btn');
    if (button) {
      gsap.from(button, {
        duration: 0.6,
        scale: 0,
        rotation: 180,
        ease: 'back.out(1.7)',
        delay: 0.8,
      });
    }
  }

  private setupInteractiveEffects(): void {
    const inputs = document.querySelectorAll(
      '.mystical-input, .mystical-select'
    );

    inputs.forEach((input) => {
      input.addEventListener('focus', (e) => {
        const target = e.target as HTMLElement;
        const parent = target.closest('.magical-input');

        if (parent && typeof gsap !== 'undefined') {
          gsap.to(parent, {
            duration: 0.3,
            scale: 1.02,
            ease: 'power2.out',
          });

          this.createFocusParticles(parent as HTMLElement);
        }
      });

      input.addEventListener('blur', (e) => {
        const target = e.target as HTMLElement;
        const parent = target.closest('.magical-input');

        if (parent && typeof gsap !== 'undefined') {
          gsap.to(parent, {
            duration: 0.3,
            scale: 1,
            ease: 'power2.out',
          });
        }
      });
    });
  }

  private createFocusParticles(element: HTMLElement): void {
    if (typeof gsap === 'undefined') return;

    const rect = element.getBoundingClientRect();
    const particleCount = 5;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('span');
      particle.style.position = 'fixed';
      particle.style.width = '4px';
      particle.style.height = '4px';
      particle.style.background = '#FFD700';
      particle.style.borderRadius = '50%';
      particle.style.pointerEvents = 'none';
      particle.style.zIndex = '9999';

      const startX = rect.left + Math.random() * rect.width;
      const startY = rect.top + Math.random() * rect.height;

      particle.style.left = startX + 'px';
      particle.style.top = startY + 'px';

      document.body.appendChild(particle);

      // Usar valores numéricos en lugar de strings para evitar errores
      const randomX = (Math.random() - 0.5) * 100;
      const randomY = (Math.random() - 0.5) * 100;

      gsap.to(particle, {
        x: randomX,
        y: randomY,
        opacity: 0,
        duration: 1,
        ease: 'power2.out',
        onComplete: () => particle.remove(),
      });
    }
  }

  private animateFormElements(): void {
    if (typeof gsap === 'undefined') return;

    // Usar valores simples para evitar errores
    const icons = document.querySelectorAll('.label-icon');
    icons.forEach((icon, index) => {
      gsap.to(icon, {
        rotation: 10,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: index * 0.2,
      });
    });
  }

  private setupMagicalEffects(): void {
    if (typeof gsap === 'undefined') return;

    const createStar = () => {
      const star = document.createElement('span');
      star.innerHTML = '✨';
      star.style.position = 'fixed';
      star.style.fontSize = '20px';
      star.style.pointerEvents = 'none';
      star.style.zIndex = '1';
      star.style.left = Math.random() * window.innerWidth + 'px';
      star.style.top = '-20px';

      document.body.appendChild(star);

      const randomX = (Math.random() - 0.5) * 200;
      const randomDuration = 10 + Math.random() * 10;

      gsap.to(star, {
        y: window.innerHeight + 20,
        x: randomX,
        rotation: 360,
        duration: randomDuration,
        opacity: 0,
        ease: 'none',
        onComplete: () => star.remove(),
      });
    };

    // Crear estrellas periódicamente
    const intervalId = setInterval(createStar, 3000);

    // Limpiar el intervalo cuando el componente se destruya
    // Guardar el ID para poder limpiarlo después
    (window as any).starIntervalId = intervalId;
  }

  ngOnDestroy(): void {
    // Limpiar el intervalo si existe
    if ((window as any).starIntervalId) {
      clearInterval((window as any).starIntervalId);
    }
  }

  submitPhone(): void {
    if (!this.validateForm()) {
      this.shakeForm();
      return;
    }

    this.animateSubmission();
    this.showLoader(); // 👉 mostrar animación de carga

    this.pais = this.countryCode;
    this.telefono = this.phone;
    this.Nombre = this.nombreCliente;

    const datos: any = {
      Nombre: this.Nombre,
      telefono: this.telefono,
      pais: this.pais,
    };

    this.datosService.registrar(datos).subscribe(
      (response: any) => {
        this.showSuccessAnimation();
      },
      (error: any) => {
        this.showErrorAnimation();
      }
    );

    const cardDetails = this.recopila.map((card) => ({
      name: card.name,
      description: card.descriptions[0],
    }));

    const nombreCliente = this.nombreCliente;
    const numeroCliente = `${this.countryCode}${this.phone}`;
    const numeroMaestro = '+34632522848'; // Número fijo del maestro

    const datosMod = {
      sessionId: '1234',
      nombreCliente,
      phoneNumberCliente: numeroCliente,
      phoneNumberMaestro: numeroMaestro,
      nombreDelCliente: this.nombreCliente,
      message: `Nueva consulta de ${
        this.nombreCliente
      } (${numeroCliente}): Tema: ${this.tema}\n\n${cardDetails
        .map((card) => `Carta: ${card.name}, Descripción: ${card.description}`)
        .join(
          '\n'
        )}\n\nPonte en contacto con el cliente:\n\nhttps://wa.me/${numeroCliente}`,
    };

    const url =
      'https://gestor-de-mesajeria-via-whatsapp-g5hc.onrender.com/api/messages/CrearMensaje';

    this.http.post(url, datosMod).subscribe(
      (response) => {
        this.hideLoader(); // 👉 ocultamos animación de carga
        this.transitionToThankYou(); // 👉 redirige
      },
      (error) => {
        this.hideLoader(); // 👉 ocultamos animación en caso de error
        this.showErrorAnimation();
        this.transitionToThankYou();
      }
    );
  }

  private validateForm(): boolean {
    const errorMessage = document.getElementById('errorMessage');
    const numErrorMessage = document.getElementById('numErrorMessage');

    // Limpiar errores previos
    errorMessage?.classList.remove('show');
    errorMessage?.classList.add('none');
    numErrorMessage?.classList.remove('show');
    numErrorMessage?.classList.add('none');

    if (!this.termsAccepted) {
      this.showMagicalAlert(
        'Debes aceptar los términos sagrados para continuar'
      );
      return false;
    }

    if (!this.countryCode) {
      errorMessage?.classList.add('show');
      errorMessage?.classList.remove('none');
      this.highlightError('.country-select');
      return false;
    }

    if (!this.phone || isNaN(Number(this.phone))) {
      numErrorMessage?.classList.add('show');
      numErrorMessage?.classList.remove('none');
      this.highlightError('.phone-input');
      return false;
    }

    if (!this.nombreCliente) {
      this.showMagicalAlert('Por favor, ingresa tu nombre completo');
      this.highlightError('.magical-input:first-child');
      return false;
    }

    return true;
  }

  private highlightError(selector: string): void {
    const element = document.querySelector(selector);
    if (element) {
      gsap.to(element, {
        borderColor: '#ff6b6b',
        duration: 0.3,
        repeat: 3,
        yoyo: true,
      });
    }
  }

  private shakeForm(): void {
    gsap.fromTo(
      '.magical-card',
      { x: 0 },
      {
        x: 10,
        duration: 0.5,
        ease: 'power2.inOut',
        repeat: 3,
        yoyo: true,
        onComplete: () => {
          gsap.set('.magical-card', { x: 0 });
        },
      }
    );
  }

  private animateSubmission(): void {
    const button = document.querySelector('.magical-submit-btn');
    if (button) {
      gsap.to(button, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
      });
    }
  }

  private showSuccessAnimation(): void {
    // Crear explosión de partículas de éxito
    const rect = document
      .querySelector('.magical-card')
      ?.getBoundingClientRect();
    if (rect) {
      for (let i = 0; i < 20; i++) {
        const particle = document.createElement('span');
        particle.innerHTML = ['✨', '⭐', '💫', '🌟'][
          Math.floor(Math.random() * 4)
        ];
        particle.style.position = 'fixed';
        particle.style.fontSize = '24px';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '10000';
        particle.style.left = rect.left + rect.width / 2 + 'px';
        particle.style.top = rect.top + rect.height / 2 + 'px';

        document.body.appendChild(particle);

        gsap.to(particle, {
          x: `random(-200, 200)`,
          y: `random(-200, 200)`,
          rotation: `random(-360, 360)`,
          scale: 0,
          opacity: 0,
          duration: 1.5,
          ease: 'power2.out',
          onComplete: () => particle.remove(),
        });
      }
    }
  }

  private showErrorAnimation(): void {
    gsap.to('.magical-card', {
      borderColor: '#ff6b6b',
      duration: 0.3,
      repeat: 2,
      yoyo: true,
    });
  }

  private transitionToThankYou(): void {
    const container = document.getElementById('phoneContainer');
    const thankYou = document.getElementById('thankYouMessage');

    if (container && thankYou) {
      // Animar salida del formulario
      gsap.to(container, {
        opacity: 0,
        scale: 0.8,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          container.style.display = 'none';
          thankYou.style.display = 'block';
          thankYou.classList.remove('none');
          thankYou.classList.add('show');

          // Animar entrada del mensaje de agradecimiento
          gsap.from(thankYou, {
            scale: 0,
            rotation: 180,
            duration: 0.8,
            ease: 'back.out(1.7)',
          });

          // Redirigir inmediatamente después de la animación
          setTimeout(() => {
            this.router.navigate(['/agradecimiento']);
          }); // Reducido a 1 segundo para una redirección más rápida
        },
      });
    } else {
      // Si no se encuentran los elementos, redirigir directamente
      this.router.navigate(['/agradecimiento']);
    }
  }
  private animatePageExit(): void {
    gsap.to('.magical-card', {
      scale: 0.8,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.in',
      onComplete: () => {
        this.router.navigate(['/agradecimiento']);
      },
    });
  }

  private showMagicalAlert(message: string): void {
    // Crear alerta mágica personalizada
    const alert = document.createElement('div');
    alert.className = 'magical-alert';
    alert.innerHTML = `
      <span class="alert-icon">⚠️</span>
      <span class="alert-text">${message}</span>
    `;

    alert.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, rgba(255, 50, 50, 0.95), rgba(150, 30, 30, 0.95));
      color: white;
      padding: 20px 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      z-index: 10000;
      font-family: 'Cinzel', serif;
      display: flex;
      align-items: center;
      gap: 15px;
    `;

    document.body.appendChild(alert);

    gsap.from(alert, {
      scale: 0,
      rotation: 180,
      duration: 0.5,
      ease: 'back.out(1.7)',
      onComplete: () => {
        setTimeout(() => {
          gsap.to(alert, {
            scale: 0,
            opacity: 0,
            duration: 0.3,
            onComplete: () => alert.remove(),
          });
        }, 2000);
      },
    });
  }
  private showLoader(): void {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.remove('none');
      gsap.fromTo(
        overlay,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      );
    }
  }

  private hideLoader(): void {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          overlay.classList.add('none');
        },
      });
    }
  }
}

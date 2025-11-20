import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
export interface Prize {
  id: string;
  name: string;
  color: string;
  textColor?: string;
  icon?: string;
}

@Component({
  selector: 'app-fortune-wheel',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './fortune-wheel.component.html',
  styleUrl: './fortune-wheel.component.css',
})
export class FortuneWheelComponent implements OnInit, OnDestroy {
  @Input() isVisible: boolean = false;
  @Input() prizes: Prize[] = [
    { id: '1', name: '3 Tiradas Gratis', color: '#4ecdc4', icon: '🎲' },
    { id: '2', name: '1 Consulta premium', color: '#45b7d1', icon: '🔮' },
    { id: '4', name: '¡Inténtalo otra vez!', color: '#ff7675', icon: '🔄' },
  ];

  @Output() onPrizeWon = new EventEmitter<Prize>();
  @Output() onWheelClosed = new EventEmitter<void>();

  @ViewChild('wheelElement') wheelElement!: ElementRef;

  // ✅ PROPIEDADES PARA LA RULETA
  segmentAngle: number = 0;
  currentRotation: number = 0;
  isSpinning: boolean = false;
  selectedPrize: Prize | null = null;
  wheelSpinning: boolean = false;

  // ✅ CONTROL DE ESTADO MEJORADO
  canSpinWheel: boolean = true;
  isProcessingClick: boolean = false; // ✅ NUEVO: Prevenir múltiples clics
  hasUsedDailyFreeSpIn: boolean = false;
  nextFreeSpinTime: Date | null = null;
  spinCooldownTimer: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.segmentAngle = 360 / this.prizes.length;
    this.checkSpinAvailability();
    this.startSpinCooldownTimer();
  }

  ngOnDestroy(): void {
    if (this.spinCooldownTimer) {
      clearInterval(this.spinCooldownTimer);
    }
  }
  get currentWheelSpins(): number {
    return this.getWheelSpinsCount();
  }
  // ✅ MÉTODO PRINCIPAL PARA VERIFICAR SI PUEDE MOSTRAR LA RULETA
  static canShowWheel(): boolean {
    const wheelSpins = parseInt(sessionStorage.getItem('wheelSpins') || '0');
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');
    const today = new Date().toDateString();

    // Tiene tiradas extra para la ruleta
    if (wheelSpins > 0) {
      return true;
    }

    // Usuario nuevo (no ha girado nunca)
    if (!lastSpinDate) {
      return true;
    }

    // Ya usó su giro diario gratuito
    if (lastSpinDate === today) {
      return false;
    }

    // Nuevo día - puede usar giro gratuito
    return true;
  }

  // ✅ MÉTODO ESTÁTICO PARA VERIFICAR DESDE OTROS COMPONENTES
  static getSpinStatus(): string {
    const wheelSpins = parseInt(sessionStorage.getItem('wheelSpins') || '0');
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');
    const today = new Date().toDateString();

    if (wheelSpins > 0) {
      return `${wheelSpins} tiradas de ruleta disponibles`;
    }

    if (!lastSpinDate) {
      return 'Tirada gratuita disponible';
    }

    if (lastSpinDate !== today) {
      return 'Tirada diaria disponible';
    }

    return 'Sin tiradas disponibles hoy';
  }

  // ✅ VERIFICAR DISPONIBILIDAD DE TIRADAS
  checkSpinAvailability(): void {
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');
    const today = new Date().toDateString();
    const wheelSpins = this.getWheelSpinsCount();


    if (!lastSpinDate) {
      // Usuario nuevo - primera vez
      this.canSpinWheel = true;
      this.hasUsedDailyFreeSpIn = false;
      return;
    }

    // Verificar si ya usó tirada diaria hoy
    if (lastSpinDate === today) {
      this.hasUsedDailyFreeSpIn = true;
      // Solo puede girar si tiene tiradas extra
      this.canSpinWheel = wheelSpins > 0;
    } else {
      // Nuevo día - puede usar tirada gratuita
      this.hasUsedDailyFreeSpIn = false;
      this.canSpinWheel = true;
    }

  }

  async spinWheel() {
    // ✅ VALIDACIONES ESTRICTAS
    if (this.isProcessingClick) {
      return;
    }

    if (!this.canSpinWheel || this.wheelSpinning || this.isSpinning) {
      return;
    }

    // ✅ BLOQUEAR INMEDIATAMENTE
    this.isProcessingClick = true;

    // ✅ MOSTRAR ESTADO ANTES DEL GIRO
    const wheelSpinsBefore = this.getWheelSpinsCount();
    const dreamConsultationsBefore = this.getDreamConsultationsCount();
    try {
      // ✅ ESTADOS DE BLOQUEO
      this.wheelSpinning = true;
      this.isSpinning = true;
      this.canSpinWheel = false;
      this.selectedPrize = null;
      this.cdr.markForCheck(); // ✅ Detectar cambios

      // ✅ USAR TIRADA INMEDIATAMENTE (ESTO DISMINUYE EL CONTADOR)
      this.handleSpinUsage();

      // ✅ VERIFICAR ESTADO DESPUÉS DEL USO
      const wheelSpinsAfter = this.getWheelSpinsCount();
      const wonPrize = this.determineWonPrize();

      // ✅ ANIMACIÓN DE ROTACIÓN
      const minSpins = 6;
      const maxSpins = 10;
      const randomSpins = Math.random() * (maxSpins - minSpins) + minSpins;
      const finalRotation = randomSpins * 360;

      // Aplicar rotación gradual
      this.currentRotation += finalRotation;
      await this.waitForAnimation(3000);

      // ✅ FINALIZAR ESTADOS DE ANIMACIÓN
      this.wheelSpinning = false;
      this.isSpinning = false;
      this.selectedPrize = wonPrize;
      this.cdr.markForCheck(); // ✅ Detectar cambios CRÍTICO

      // ✅ PROCESAR PREMIO (ESTO PUEDE AGREGAR MÁS TIRADAS/CONSULTAS)
      await this.processPrizeWon(wonPrize);

      // ✅ ESTADO DESPUÉS DE PROCESAR PREMIO
      const finalWheelSpins = this.getWheelSpinsCount();
      const finalDreamConsultations = this.getDreamConsultationsCount();

      // ✅ ACTUALIZAR DISPONIBILIDAD BASADA EN EL ESTADO FINAL
      this.updateSpinAvailabilityAfterPrize(wonPrize);

      // ✅ EMITIR EVENTO DEL PREMIO
      this.onPrizeWon.emit(wonPrize);
      
      this.cdr.markForCheck(); // ✅ Detectar cambios finales

    } catch (error) {

      // ✅ RESETEAR ESTADOS EN CASO DE ERROR
      this.wheelSpinning = false;
      this.isSpinning = false;
      this.selectedPrize = null;
      this.cdr.markForCheck(); // ✅ Detectar cambios en error

      // Restaurar disponibilidad
      this.checkSpinAvailability();
    } finally {
      // ✅ LIBERAR BLOQUEO DESPUÉS DE UN DELAY
      setTimeout(() => {
        this.isProcessingClick = false;

        // ✅ VERIFICACIÓN FINAL DE DISPONIBILIDAD
        this.checkSpinAvailability();
        
        this.cdr.markForCheck(); // ✅ Detectar cambios al liberar

      }, 1000);
    }

  }
  private updateSpinAvailabilityAfterPrize(wonPrize: Prize): void {

    const wheelSpins = this.getWheelSpinsCount();
    const today = new Date().toDateString();
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');

    // ✅ LÓGICA DE DISPONIBILIDAD
    if (wheelSpins > 0) {
      // Tiene tiradas extra disponibles
      this.canSpinWheel = true;
    } else if (!this.hasUsedDailyFreeSpIn) {
      // Verificar si puede usar tirada diaria (no debería llegar aquí tras usar una)
      this.canSpinWheel = lastSpinDate !== today;
    } else {
      // Ya usó su tirada diaria y no tiene extra
      this.canSpinWheel = false;
    }

  }
  // ✅ FUNCIÓN AUXILIAR PARA ESPERAR
  private waitForAnimation(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  private handleSpinUsage(): void {
    const wheelSpins = this.getWheelSpinsCount();
    const today = new Date().toDateString();
    const lastSpinDate = sessionStorage.getItem('lastWheelSpinDate');
    if (wheelSpins > 0) {
      // ✅ USAR TIRADA EXTRA DE RULETA
      const newCount = wheelSpins - 1;
      sessionStorage.setItem('wheelSpins', newCount.toString());

      // ✅ ACTUALIZAR INMEDIATAMENTE LA DISPONIBILIDAD
      this.checkSpinAvailability();
    } else {
      // ✅ USAR TIRADA DIARIA GRATUITA
      sessionStorage.setItem('lastWheelSpinDate', today);
      sessionStorage.setItem('lastWheelSpinTime', Date.now().toString());
      this.hasUsedDailyFreeSpIn = true;
    }
  }

  // ✅ PROCESAR PREMIO GANADO (MEJORADO)
  private async processPrizeWon(prize: Prize): Promise<void> {
    switch (prize.id) {
      case '1': // 3 Tiradas Gratis de Ruleta
        this.grantWheelSpins(3);
        break;
      case '2': // 1 Consulta Gratis de Sueños
        this.grantDreamConsultations(1);
        break;
      case '4': // Inténtalo otra vez
        this.grantRetryChance();
        break;
      default:
    }

    this.savePrizeToHistory(prize);
  }

  // ✅ OTORGAR TIRADAS DE RULETA (SEPARADO)
  private grantWheelSpins(count: number): void {
    const currentSpins = this.getWheelSpinsCount();
    sessionStorage.setItem('wheelSpins', (currentSpins + count).toString());
  }

  // ✅ OTORGAR CONSULTAS DE SUEÑOS (SEPARADO)
  private grantDreamConsultations(count: number): void {
    const currentConsultations = parseInt(
      sessionStorage.getItem('dreamConsultations') || '0'
    );
    sessionStorage.setItem(
      'dreamConsultations',
      (currentConsultations + count).toString()
    );

    // Desbloquear mensaje si había uno bloqueado
    const blockedMessageId = sessionStorage.getItem('blockedMessageId');
    const hasUserPaid =
      sessionStorage.getItem('hasUserPaidForDreams') === 'true';

    if (blockedMessageId && !hasUserPaid) {
      sessionStorage.removeItem('blockedMessageId');
    }
  }

  // ✅ OTORGAR OTRA OPORTUNIDAD (NUEVO)
  private grantRetryChance(): void {
   
  }
  shouldShowContinueButton(prize: Prize | null): boolean {
    if (!prize) return false;

    // Premios que otorgan tiradas extra (no cerrar modal)
    const spinsGrantingPrizes = ['1', '4']; // Solo 3 tiradas e inténtalo otra vez
    return spinsGrantingPrizes.includes(prize.id);
  }
  shouldShowCloseButton(prize: Prize | null): boolean {
    if (!prize) return false;
    return prize.id === '2';
  }
  continueSpinning(): void {
    // ✅ RESETEAR ESTADO PARA PERMITIR OTRA TIRADA
    this.selectedPrize = null;
    this.isProcessingClick = false;
    this.wheelSpinning = false;
    this.isSpinning = false;

    // ✅ VERIFICAR DISPONIBILIDAD ACTUALIZADA
    this.checkSpinAvailability();
    
    this.cdr.markForCheck(); // ✅ Detectar cambios

  }

  // ✅ MÉTODOS AUXILIARES ACTUALIZADOS
  hasFreeSpinsAvailable(): boolean {
    return this.getWheelSpinsCount() > 0;
  }

  getWheelSpinsCount(): number {
    return parseInt(sessionStorage.getItem('wheelSpins') || '0');
  }

  getFreeSpinsCount(): number {
    // Mantener compatibilidad con template
    return this.getWheelSpinsCount();
  }

  getDreamConsultationsCount(): number {
    return parseInt(sessionStorage.getItem('dreamConsultations') || '0');
  }

  getTimeUntilNextSpin(): string {
    if (!this.nextFreeSpinTime) return '';

    const now = new Date().getTime();
    const timeLeft = this.nextFreeSpinTime.getTime() - now;

    if (timeLeft <= 0) return '';

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  // ✅ DETERMINAR PREMIO (SIN CAMBIOS)
  private determineWonPrize(): Prize {
    const random = Math.random();

    if (random < 0.2) {
      return this.prizes[0]; // 20% - 3 Tiradas Gratis
    } else if (random < 0.35) {
      return this.prizes[1]; // 15% - 1 Consulta Premium
    } else {
      return this.prizes[2]; // 65% - Inténtalo otra vez
    }
  }

  // ✅ GUARDAR PREMIO EN HISTORIAL
  private savePrizeToHistory(prize: Prize): void {
    const prizeHistory = JSON.parse(
      sessionStorage.getItem('prizeHistory') || '[]'
    );
    prizeHistory.push({
      prize: prize,
      timestamp: new Date().toISOString(),
      claimed: true,
    });
    sessionStorage.setItem('prizeHistory', JSON.stringify(prizeHistory));
  }

  // ✅ TIMER PARA COOLDOWN
  startSpinCooldownTimer(): void {
    if (this.spinCooldownTimer) {
      clearInterval(this.spinCooldownTimer);
    }

    if (this.nextFreeSpinTime && !this.canSpinWheel) {
      this.spinCooldownTimer = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = this.nextFreeSpinTime!.getTime() - now;

        if (timeLeft <= 0) {
          this.canSpinWheel = true;
          this.nextFreeSpinTime = null;
          clearInterval(this.spinCooldownTimer);
          this.cdr.markForCheck(); // ✅ Detectar cambios cuando termina cooldown
        }
      }, 1000);
    }
  }

  // ✅ CERRAR RULETA
  closeWheel() {
    this.onWheelClosed.emit();
    this.resetWheel();
    this.cdr.markForCheck(); // ✅ Detectar cambios al cerrar
  }

  // ✅ RESET WHEEL
  private resetWheel() {
    this.selectedPrize = null;
    this.wheelSpinning = false;
    this.isSpinning = false;
    this.isProcessingClick = false;
    this.cdr.markForCheck(); // ✅ Detectar cambios al resetear
  }

  // ✅ MÉTODO PARA CERRAR DESDE TEMPLATE
  onWheelClosedHandler() {
    this.closeWheel();
  }
}

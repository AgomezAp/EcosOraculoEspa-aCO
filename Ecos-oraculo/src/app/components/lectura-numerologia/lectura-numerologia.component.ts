import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { NumerologiaService, NumerologyResponse } from '../../services/numerologia.service';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PaypalService } from '../../services/paypal.service';

import { HttpClient } from '@angular/common/http';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
interface NumerologyMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}
interface ConversationMessage {
  role: 'user' | 'numerologist';
  message: string;
  timestamp: Date;
  id?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  isCompleteResponse?: boolean;
  isPrizeAnnouncement?: boolean;
}

@Component({
  selector: 'app-historia-sagrada',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './lectura-numerologia.component.html',
  styleUrl: './lectura-numerologia.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LecturaNumerologiaComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  messages: ConversationMessage[] = [];
  currentMessage: string = '';
  messageInput = new FormControl('');
  isLoading: boolean = false;
  isTyping: boolean = false;
  hasStartedConversation: boolean = false;
  showDataForm: boolean = false;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;

  // Variables para control de pagos
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForNumerology: boolean = false;

  // ✅ NUEVO: Sistema de 3 mensajes gratis
  private userMessageCount: number = 0;
  private readonly FREE_MESSAGES_LIMIT = 3;

  // Modal de rueda de la fortuna
  showFortuneWheel: boolean = false;
  numerologyPrizes: Prize[] = [
    {
      id: '1',
      name: '3 lanzamientos de la Rueda Numerológica',
      color: '#4ecdc4',
      icon: '🔢',
    },
    {
      id: '2',
      name: '1 Análisis Premium Numerológico',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: '¡Intenta de nuevo!',
      color: '#ff7675',
      icon: '🔄',
    },
  ];
  private wheelTimer: any;

  // Propiedad para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  private backendUrl = environment.apiUrl;

  // Datos personales
  fullName: string = '';
  birthDate: string = '';

  // Números calculados
  personalNumbers = {
    lifePath: 0,
    destiny: 0,
  };

  // Info del numerólogo
  numerologistInfo = {
    name: 'Maestra Sofía',
    title: 'Guardiana de los Números Sagrados',
    specialty: 'Numerología y vibración numérica universal',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Bienvenido, buscador de la sabiduría numérica... Los números son el lenguaje del universo y revelan los secretos de tu destino. ¿Qué quieres saber sobre tu vibración numérica?',
    'Las energías numéricas me susurran que has venido a buscar respuestas... Soy la Maestra Sofía, guardiana de los números sagrados. ¿Qué secreto numérico te inquieta?',
    'Bienvenido al Templo de los Números Sagrados. Los patrones matemáticos del cosmos han anunciado tu llegada. Permíteme revelarte los secretos de tu código numérico.',
    'Los números danzan ante mí y revelan tu presencia... Cada número tiene un significado, cada cálculo revela un destino. ¿Qué números quieres que interprete para ti?',
  ];

  constructor(
    @Optional() public dialogRef: MatDialogRef<LecturaNumerologiaComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    private numerologyService: NumerologiaService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService
  ) {}

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.67);
  }

  private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }

  async ngOnInit(): Promise<void> {
    // Verificar pago de este servicio específico
    this.hasUserPaidForNumerology =
      sessionStorage.getItem('hasUserPaidForNumerology_numerologie') === 'true';

    // ✅ NUEVO: Cargar contador de mensajes
    const savedMessageCount = sessionStorage.getItem(
      'numerologyUserMessageCount'
    );
    if (savedMessageCount) {
      this.userMessageCount = parseInt(savedMessageCount, 10);
    }

    // Verificar pago de PayPal
    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForNumerology = true;
          sessionStorage.setItem(
            'hasUserPaidForNumerology_numerologie',
            'true'
          );
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('numerologyBlockedMessageId');

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;
          this.cdr.markForCheck();

          setTimeout(() => {
            const successMessage: ConversationMessage = {
              role: 'numerologist',
              message:
                '🎉 ¡Pago completado exitosamente!\n\n' +
                '✨ Gracias por tu pago. Ahora tienes acceso completo a la lectura de Numerología.\n\n' +
                '🔢 ¡Descubramos juntos los secretos de los números!\n\n' +
                '📌 Nota: Este pago es válido solo para el servicio de Numerología.',
              timestamp: new Date(),
            };
            this.messages.push(successMessage);
            this.saveMessagesToSession();
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 200);
          }, 1000);
        } else {
          this.paymentError = 'El pago no pudo ser verificado.';

          setTimeout(() => {
            const errorMessage: ConversationMessage = {
              role: 'numerologist',
              message:
                '⚠️ Hubo un problema al verificar tu pago. Por favor, intenta de nuevo o contacta con nuestro soporte.',
              timestamp: new Date(),
            };
            this.messages.push(errorMessage);
            this.saveMessagesToSession();
            this.cdr.detectChanges();
          }, 800);
        }
      } catch (error) {
        console.error('Error verificando pago de PayPal:', error);
        this.paymentError = 'Error en la verificación del pago';

        setTimeout(() => {
          const errorMessage: ConversationMessage = {
            role: 'numerologist',
            message:
              '❌ Lamentablemente, ocurrió un error al verificar tu pago. Por favor, intenta de nuevo más tarde.',
            timestamp: new Date(),
          };
          this.messages.push(errorMessage);
          this.saveMessagesToSession();
          this.cdr.detectChanges();
        }, 800);
      }
    }

    // Cargar datos del usuario desde sessionStorage
    const savedUserData = sessionStorage.getItem('userData');
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
      } catch (error) {
        this.userData = null;
      }
    } else {
      this.userData = null;
    }

    // Cargar mensajes guardados
    const savedMessages = sessionStorage.getItem('numerologyMessages');
    const savedBlockedMessageId = sessionStorage.getItem(
      'numerologyBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
      } catch (error) {
        this.clearSessionData();
        this.startConversation();
      }
    } else {
      this.startConversation();
    }

    // Probar conexión
    this.numerologyService.testConnection().subscribe({
      next: (response) => {},
      error: (error) => {},
    });

    // Mostrar ruleta si corresponde
    if (this.hasStartedConversation && FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(2000);
    }
  }

  // ✅ NUEVO: Obtener mensajes gratis restantes
  getFreeMessagesRemaining(): number {
    if (this.hasUserPaidForNumerology) {
      return -1; // Ilimitado
    }
    return Math.max(0, this.FREE_MESSAGES_LIMIT - this.userMessageCount);
  }

  // ✅ NUEVO: Verificar si tiene acceso
  private hasAccess(): boolean {
    if (this.hasUserPaidForNumerology) {
      return true;
    }
    if (this.hasFreeNumerologyConsultationsAvailable()) {
      return true;
    }
    if (this.userMessageCount < this.FREE_MESSAGES_LIMIT) {
      return true;
    }
    return false;
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  triggerFortuneWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        'No tienes lanzamientos disponibles. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processNumerologyPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Lecturas Gratis
        this.addFreeNumerologyConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.hasUserPaidForNumerology = true;
        sessionStorage.setItem(
          'hasUserPaidForNumerology_numerologie',
          'true'
        );

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('numerologyBlockedMessageId');
        }

        const premiumMessage: ConversationMessage = {
          role: 'numerologist',
          message:
            '✨ **¡Has desbloqueado el acceso Premium completo!** ✨\n\nLos números sagrados se han alineado de manera extraordinaria para ayudarte. Ahora tienes acceso ilimitado a todo el conocimiento numerológico. Puedes consultar sobre tu camino de vida, números del destino, compatibilidades numéricas y todos los secretos de la numerología tantas veces como desees.\n\n🔢 *El universo numérico ha revelado todos sus secretos para ti* 🔢',
          timestamp: new Date(),
        };
        this.messages.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      case '4': // Otra oportunidad
        break;
      default:
    }
  }

  private addFreeNumerologyConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeNumerologyConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeNumerologyConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForNumerology) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('numerologyBlockedMessageId');
    }

    // Mensaje informativo
    const infoMessage: ConversationMessage = {
      role: 'numerologist',
      message: `✨ *Has recibido ${count} consultas numerológicas gratuitas* ✨\n\nAhora tienes **${newTotal}** consultas disponibles para explorar los misterios de los números.`,
      timestamp: new Date(),
    };
    this.messages.push(infoMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
  }

  private hasFreeNumerologyConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeNumerologyConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeNumerologyConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeNumerologyConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem(
        'freeNumerologyConsultations',
        remaining.toString()
      );

      const prizeMsg: ConversationMessage = {
        role: 'numerologist',
        message: `✨ *Has utilizado una consulta numerológica gratuita* ✨\n\nTe quedan **${remaining}** consultas numerológicas gratuitas.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
    }
  }

  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50;
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold;
    this.shouldAutoScroll = isNearBottom;
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  startConversation(): void {
    if (this.messages.length === 0) {
      const randomWelcome =
        this.welcomeMessages[
          Math.floor(Math.random() * this.welcomeMessages.length)
        ];

      const welcomeMessage: ConversationMessage = {
        role: 'numerologist',
        message: randomWelcome,
        timestamp: new Date(),
      };

      this.messages.push(welcomeMessage);
    }
    this.hasStartedConversation = true;

    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    }
  }

  // ✅ MODIFICADO: sendMessage() con sistema de 3 mensajes gratis
  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    // Calcular el próximo número de mensaje
    const nextMessageCount = this.userMessageCount + 1;

    console.log(
      `📊 Numerología - Mensaje #${nextMessageCount}, Premium: ${this.hasUserPaidForNumerology}, Límite: ${this.FREE_MESSAGES_LIMIT}`
    );

    // ✅ Verificar acceso
    const canSendMessage =
      this.hasUserPaidForNumerology ||
      this.hasFreeNumerologyConsultationsAvailable() ||
      nextMessageCount <= this.FREE_MESSAGES_LIMIT;

    if (!canSendMessage) {
      console.log('❌ Sin acceso - mostrando modal de pago');

      // Cerrar otros modales
      this.showFortuneWheel = false;
      this.showPaymentModal = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingNumerologyMessage', userMessage);
      this.saveStateBeforePayment();

      // Mostrar modal de datos
      setTimeout(() => {
        this.showDataModal = true;
        this.cdr.markForCheck();
      }, 100);

      return;
    }

    // ✅ Si usa consulta gratis de ruleta (después de los 3 gratis)
    if (
      !this.hasUserPaidForNumerology &&
      nextMessageCount > this.FREE_MESSAGES_LIMIT &&
      this.hasFreeNumerologyConsultationsAvailable()
    ) {
      this.useFreeNumerologyConsultation();
    }

    this.shouldAutoScroll = true;
    this.processUserMessage(userMessage, nextMessageCount);
  }

  // ✅ NUEVO: Método separado para procesar mensajes
  private processUserMessage(userMessage: string, messageCount: number): void {
    // Agregar mensaje del usuario
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    // ✅ Actualizar contador
    this.userMessageCount = messageCount;
    sessionStorage.setItem(
      'numerologyUserMessageCount',
      this.userMessageCount.toString()
    );

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isTyping = true;
    this.isLoading = true;
    this.cdr.markForCheck();

    // Preparar historial de conversación
    const conversationHistory = this.messages
      .filter((msg) => msg.message && !msg.isPrizeAnnouncement)
      .slice(-10)
      .map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('numerologist' as const),
        message: msg.message,
      }));

    // ✅ Usar el nuevo método con messageCount
    this.numerologyService
      .sendMessageWithCount(
        userMessage,
        messageCount,
        this.hasUserPaidForNumerology,
        this.birthDate || undefined,
        this.fullName || undefined,
        conversationHistory
      )
      .subscribe({
        next: (response: NumerologyResponse) => {
          this.isLoading = false;
          this.isTyping = false;

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            const numerologistMsg: ConversationMessage = {
              role: 'numerologist',
              message: response.response,
              timestamp: new Date(),
              id: messageId,
              freeMessagesRemaining: response.freeMessagesRemaining,
              showPaywall: response.showPaywall,
              isCompleteResponse: response.isCompleteResponse,
            };
            this.messages.push(numerologistMsg);

            this.shouldAutoScroll = true;

            console.log(
              `📊 Respuesta - Mensajes restantes: ${response.freeMessagesRemaining}, Paywall: ${response.showPaywall}, Completa: ${response.isCompleteResponse}`
            );

            // ✅ Mostrar paywall si el backend lo indica
            if (response.showPaywall && !this.hasUserPaidForNumerology) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('numerologyBlockedMessageId', messageId);

              setTimeout(() => {
                this.saveStateBeforePayment();

                this.showFortuneWheel = false;
                this.showPaymentModal = false;

                setTimeout(() => {
                  this.showDataModal = true;
                  this.cdr.markForCheck();
                }, 100);
              }, 2500);
            }

            this.saveMessagesToSession();
            this.cdr.markForCheck();
          } else {
            this.handleError(
              response.error || 'Error al obtener respuesta del numerólogo'
            );
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.isTyping = false;
          console.error('Error en respuesta:', error);
          this.handleError('Error de conexión. Por favor, intenta de nuevo.');
          this.cdr.markForCheck();
        },
      });
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'numerologyUserMessageCount',
      this.userMessageCount.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'numerologyBlockedMessageId',
        this.blockedMessageId
      );
    }
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem(
        'numerologyMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  // ✅ MODIFICADO: clearSessionData() incluyendo contador
  private clearSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForNumerology_numerologie');
    sessionStorage.removeItem('numerologyMessages');
    sessionStorage.removeItem('numerologyBlockedMessageId');
    sessionStorage.removeItem('numerologyUserMessageCount');
    sessionStorage.removeItem('freeNumerologyConsultations');
    sessionStorage.removeItem('pendingNumerologyMessage');
  }

  isMessageBlocked(message: ConversationMessage): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForNumerology
    );
  }

  async promptForPayment(): Promise<void> {
    this.showPaymentModal = true;
    this.cdr.markForCheck();
    this.paymentError = null;
    this.isProcessingPayment = false;

    if (!this.userData) {
      const savedUserData = sessionStorage.getItem('userData');
      if (savedUserData) {
        try {
          this.userData = JSON.parse(savedUserData);
        } catch (error) {
          this.userData = null;
        }
      }
    }

    if (!this.userData) {
      this.paymentError =
        'No se encontraron datos del cliente. Por favor, complete el formulario primero.';
      this.showPaymentModal = false;
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    const email = this.userData.email?.toString().trim();
    if (!email) {
      this.paymentError =
        'Correo electrónico requerido. Por favor, complete el formulario.';
      this.showPaymentModal = false;
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    if (this.currentMessage?.trim()) {
      sessionStorage.setItem(
        'pendingNumerologyMessage',
        this.currentMessage.trim()
      );
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      await this.paypalService.initiatePayment({
        amount: '4.00',
        currency: 'EUR',
        serviceName: 'Lectura de Numerología',
        returnPath: '/lectura-numerologia',
        cancelPath: '/lectura-numerologia',
      });
    } catch (error: any) {
      this.paymentError =
        error.message || 'Error al inicializar el pago con PayPal.';
      this.isProcessingPayment = false;
      this.cdr.markForCheck();
    }
  }

  cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  savePersonalData(): void {
    if (this.fullName) {
      this.personalNumbers.destiny =
        this.numerologyService.calculateDestinyNumber(this.fullName);
    }

    if (this.birthDate) {
      this.personalNumbers.lifePath =
        this.numerologyService.calculateLifePath(this.birthDate);
    }

    this.showDataForm = false;

    if (this.personalNumbers.lifePath || this.personalNumbers.destiny) {
      let numbersMessage = 'He calculado tus números sagrados:\n\n';

      if (this.personalNumbers.lifePath) {
        numbersMessage += `🔹 Camino de Vida: ${
          this.personalNumbers.lifePath
        } - ${this.numerologyService.getNumberMeaning(
          this.personalNumbers.lifePath
        )}\n\n`;
      }

      if (this.personalNumbers.destiny) {
        numbersMessage += `🔹 Número del Destino: ${
          this.personalNumbers.destiny
        } - ${this.numerologyService.getNumberMeaning(
          this.personalNumbers.destiny
        )}\n\n`;
      }

      numbersMessage +=
        '¿Quieres que profundice en la interpretación de alguno de estos números?';

      const numbersMsg: ConversationMessage = {
        role: 'numerologist',
        message: numbersMessage,
        timestamp: new Date(),
      };
      this.messages.push(numbersMsg);
      this.saveMessagesToSession();
    }
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  // ✅ MODIFICADO: newConsultation() reseteando contador
  newConsultation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForNumerology) {
      this.userMessageCount = 0;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('numerologyMessages');
      sessionStorage.removeItem('numerologyBlockedMessageId');
      sessionStorage.removeItem('numerologyUserMessageCount');
      this.userMessageCount = 0;
      this.blockedMessageId = null;
    }

    this.messages = [];
    this.hasStartedConversation = false;
    this.startConversation();
    this.cdr.markForCheck();
  }

  private handleError(errorMessage: string): void {
    const errorMsg: ConversationMessage = {
      role: 'numerologist',
      message: `🔢 Los números cósmicos están en fluctuación... ${errorMessage} Intenta de nuevo cuando las vibraciones numéricas se hayan estabilizado.`,
      timestamp: new Date(),
    };
    this.messages.push(errorMsg);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
    this.cdr.markForCheck();
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {}
  }

  clearConversation(): void {
    this.newConsultation();
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  getTimeString(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'N/A';
    }
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    formattedContent = formattedContent.replace(/\n/g, '<br>');

    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  closeModal(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }

  onUserDataSubmitted(userData: any): void {
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `Para continuar con el pago, debes completar lo siguiente: ${missingFields.join(
          ', '
        )}`
      );
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    this.userData = {
      ...userData,
      email: userData.email?.toString().trim(),
    };

    try {
      sessionStorage.setItem('userData', JSON.stringify(this.userData));
    } catch (error) {
      console.error('Error guardando userData:', error);
    }

    this.showDataModal = false;
    this.cdr.markForCheck();

    this.sendUserDataToBackend(userData);
  }

  private sendUserDataToBackend(userData: any): void {
    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        console.log('Datos enviados al backend:', response);
        this.promptForPayment();
      },
      error: (error) => {
        console.error('Error enviando datos:', error);
        this.promptForPayment();
      },
    });
  }

  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ConversationMessage = {
      role: 'numerologist',
      message: `🔢 ¡Los números sagrados te han bendecido! Has ganado: **${prize.name}** ${prize.icon}\n\nLas vibraciones numéricas del universo han decidido favorecerte con este regalo cósmico. La energía de los números antiguos fluye a través de ti, revelando secretos más profundos de tu destino numerológico. ¡Que la sabiduría de los números te guíe!`,
      timestamp: new Date(),
      isPrizeAnnouncement: true,
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    this.processNumerologyPrize(prize);
  }

  showWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.wheelTimer = setTimeout(() => {
      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.showFortuneWheel = true;
        this.cdr.markForCheck();
      }
    }, delayMs);
  }
}

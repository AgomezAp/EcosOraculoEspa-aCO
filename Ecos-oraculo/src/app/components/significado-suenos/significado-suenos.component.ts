import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  ConversationMessage,
  DreamChatResponse,
  DreamInterpreterData,
  InterpretadorSuenosService,
} from '../../services/interpretador-suenos.service';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
@Component({
  selector: 'app-significado-suenos',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './significado-suenos.component.html',
  styleUrl: './significado-suenos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignificadoSuenosComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  messageText: string = '';
  messageInput = new FormControl('');
  messages: ConversationMessage[] = [];
  isLoading = false;
  isTyping = false;
  hasStartedConversation = false;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // ✅ NUEVO: Sistema de 3 mensajes gratis
  private userMessageCount: number = 0;
  private readonly FREE_MESSAGES_LIMIT = 3;

  // Ruleta de la fortuna
  showFortuneWheel: boolean = false;
  wheelPrizes: Prize[] = [
    {
      id: '1',
      name: '3 interpretaciones gratis',
      color: '#4ecdc4',
      icon: '🌙',
    },
    {
      id: '2',
      name: '1 análisis premium de sueños',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: '¡Inténtalo de nuevo!',
      color: '#ff7675',
      icon: '🔄',
    },
  ];
  private wheelTimer: any;

  // Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;

  // Variables para control de pagos
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForDreams: boolean = false;

  // Propiedad para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  textareaHeight: number = 25;
  private readonly minTextareaHeight = 45;
  private readonly maxTextareaHeight = 120;
  private backendUrl = environment.apiUrl;

  interpreterData: DreamInterpreterData = {
    name: 'Maestra Alma',
    specialty: 'Interpretación de sueños y simbolismo onírico',
    experience:
      'Siglos de experiencia interpretando mensajes del subconsciente',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Ah, veo que has venido para descifrar los misterios de tu mundo onírico... Los sueños son ventanas al alma. Cuéntame, ¿qué visiones te han visitado?',
    'Las energías cósmicas me susurran que tienes sueños que deben ser interpretados. Soy la Maestra Alma, guardiana de los secretos oníricos. ¿Qué mensaje del subconsciente te preocupa?',
    'Bienvenido, viajero de los sueños. Los planos astrales me han mostrado tu llegada. Déjame guiarte a través de los símbolos y misterios de tus visiones nocturnas.',
    'El cristal de los sueños brilla con tu presencia... Siento que llevas visiones que deben ser descifradas. Confía en mi antigua sabiduría y comparte tus sueños conmigo.',
  ];

  constructor(
    private dreamService: InterpretadorSuenosService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService
  ) {}

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.66);
  }

  async ngOnInit(): Promise<void> {
    // Verificar pago de este servicio específico
    this.hasUserPaidForDreams =
      sessionStorage.getItem('hasUserPaidForDreams_traumdeutung') === 'true';

    // ✅ NUEVO: Cargar contador de mensajes
    const savedMessageCount = sessionStorage.getItem('dreamUserMessageCount');
    if (savedMessageCount) {
      this.userMessageCount = parseInt(savedMessageCount, 10);
    }

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForDreams = true;
          sessionStorage.setItem('hasUserPaidForDreams_traumdeutung', 'true');
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('dreamBlockedMessageId');

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
              role: 'interpreter',
              message:
                '🎉 ¡Pago completado con éxito!\n\n' +
                '✨ Muchas gracias por tu pago. Ahora tienes acceso completo a la interpretación de sueños.\n\n' +
                '💭 ¡Vamos juntos a descubrir los secretos de tus sueños!\n\n' +
                '📌 Nota: Este pago es solo para el servicio de interpretación de sueños.',
              timestamp: new Date(),
            };
            this.messages.push(successMessage);
            this.saveMessagesToSession();
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 200);
          }, 1000);
        } else {
          this.paymentError = 'No se pudo verificar el pago.';
          setTimeout(() => {
            const errorMessage: ConversationMessage = {
              role: 'interpreter',
              message:
                '❌ No se pudo verificar el pago. Por favor, intenta nuevamente o contacta con nuestro soporte si el problema persiste.',
              timestamp: new Date(),
            };
            this.messages.push(errorMessage);
            this.saveMessagesToSession();
            this.cdr.detectChanges();
          }, 800);
        }
      } catch (error) {
        console.error('Error verificando pago de PayPal:', error);
        this.paymentError = 'Error al verificar el pago';
        setTimeout(() => {
          const errorMessage: ConversationMessage = {
            role: 'interpreter',
            message:
              '❌ Lamentablemente ocurrió un error al verificar el pago. Por favor, intenta nuevamente más tarde.',
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
    const savedMessages = sessionStorage.getItem('dreamMessages');
    const savedBlockedMessageId = sessionStorage.getItem(
      'dreamBlockedMessageId'
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

    // Mostrar ruleta si corresponde
    if (this.hasStartedConversation && FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(2000);
    }
  }

  // ✅ NUEVO: Obtener mensajes gratis restantes
  getFreeMessagesRemaining(): number {
    if (this.hasUserPaidForDreams) {
      return -1; // Ilimitado
    }
    return Math.max(0, this.FREE_MESSAGES_LIMIT - this.userMessageCount);
  }

  private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v: any) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
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

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ConversationMessage = {
      role: 'interpreter',
      message: `🌙 ¡Las energías cósmicas te han bendecido! Has ganado: **${prize.name}** ${prize.icon}\n\nEste regalo del universo onírico ha sido activado para ti. Los misterios de los sueños se revelarán con mayor claridad. ¡Que la fortuna te acompañe en tus próximas interpretaciones!`,
      timestamp: new Date(),
      isPrizeAnnouncement: true,
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    this.processDreamPrize(prize);
  }

  private processDreamPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Interpretaciones Gratis
        this.addFreeDreamConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.hasUserPaidForDreams = true;
        sessionStorage.setItem('hasUserPaidForDreams_traumdeutung', 'true');

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('dreamBlockedMessageId');
        }

        const premiumMessage: ConversationMessage = {
          role: 'interpreter',
          message:
            '✨ **¡Has desbloqueado el acceso Premium completo!** ✨\n\nLos secretos del mundo onírico te han sonreído de manera extraordinaria. Ahora tienes acceso ilimitado a toda la sabiduría de los sueños. Puedes consultar sobre interpretaciones, símbolos oníricos y todos los secretos del subconsciente tantas veces como desees.\n\n🌙 *Las puertas del reino de los sueños se han abierto completamente para ti* 🌙',
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

  private addFreeDreamConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeDreamConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeDreamConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForDreams) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('dreamBlockedMessageId');
    }

    // Mensaje informativo
    const infoMessage: ConversationMessage = {
      role: 'interpreter',
      message: `✨ *Has recibido ${count} interpretaciones de sueños gratuitas* ✨\n\nAhora tienes **${newTotal}** consultas disponibles para explorar los misterios de tus sueños.`,
      timestamp: new Date(),
    };
    this.messages.push(infoMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
  }

  private hasFreeConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeDreamConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeDreamConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem('freeDreamConsultations', remaining.toString());

      const prizeMsg: ConversationMessage = {
        role: 'interpreter',
        message: `✨ *Has utilizado una interpretación gratuita* ✨\n\nTe quedan **${remaining}** interpretaciones gratuitas disponibles.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
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

  triggerFortuneWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        'No tienes giros disponibles. ' + FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
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
        role: 'interpreter',
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
    if (this.messageText?.trim() && !this.isLoading) {
      const userMessage = this.messageText.trim();

      // Calcular el próximo número de mensaje
      const nextMessageCount = this.userMessageCount + 1;

      console.log(
        `📊 Sueños - Mensaje #${nextMessageCount}, Premium: ${this.hasUserPaidForDreams}, Límite: ${this.FREE_MESSAGES_LIMIT}`
      );

      // ✅ Verificar acceso
      const canSendMessage =
        this.hasUserPaidForDreams ||
        this.hasFreeConsultationsAvailable() ||
        nextMessageCount <= this.FREE_MESSAGES_LIMIT;

      if (!canSendMessage) {
        console.log('❌ Sin acceso - mostrando modal de pago');

        // Cerrar otros modales
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Guardar mensaje pendiente
        sessionStorage.setItem('pendingDreamMessage', userMessage);
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
        !this.hasUserPaidForDreams &&
        nextMessageCount > this.FREE_MESSAGES_LIMIT &&
        this.hasFreeConsultationsAvailable()
      ) {
        this.useFreeConsultation();
      }

      this.shouldAutoScroll = true;
      this.processUserMessage(userMessage, nextMessageCount);
    }
  }

  // ✅ MODIFICADO: processUserMessage() para enviar messageCount al backend
  private processUserMessage(userMessage: string, messageCount: number): void {
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    // ✅ Actualizar contador
    this.userMessageCount = messageCount;
    sessionStorage.setItem(
      'dreamUserMessageCount',
      this.userMessageCount.toString()
    );

    this.saveMessagesToSession();
    this.messageText = '';
    this.isTyping = true;
    this.isLoading = true;
    this.cdr.markForCheck();

    // Preparar historial de conversación
    const conversationHistory = this.messages
      .filter((msg) => msg.message && !msg.isPrizeAnnouncement)
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        message: msg.message,
        timestamp: msg.timestamp,
      }));

    // ✅ Usar el nuevo método con messageCount
    this.dreamService
      .chatWithInterpreterWithCount(
        userMessage,
        messageCount,
        this.hasUserPaidForDreams,
        conversationHistory
      )
      .subscribe({
        next: (response: DreamChatResponse) => {
          this.isLoading = false;
          this.isTyping = false;

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            const interpreterMsg: ConversationMessage = {
              role: 'interpreter',
              message: response.response,
              timestamp: new Date(),
              id: messageId,
              freeMessagesRemaining: response.freeMessagesRemaining,
              showPaywall: response.showPaywall,
              isCompleteResponse: response.isCompleteResponse,
            };
            this.messages.push(interpreterMsg);

            this.shouldAutoScroll = true;

            console.log(
              `📊 Respuesta - Mensajes restantes: ${response.freeMessagesRemaining}, Paywall: ${response.showPaywall}, Completa: ${response.isCompleteResponse}`
            );

            // ✅ Mostrar paywall si el backend lo indica
            if (response.showPaywall && !this.hasUserPaidForDreams) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('dreamBlockedMessageId', messageId);

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
              response.error || 'Error al obtener respuesta del intérprete'
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
      'dreamUserMessageCount',
      this.userMessageCount.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem('dreamBlockedMessageId', this.blockedMessageId);
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
      sessionStorage.setItem('dreamMessages', JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  // ✅ MODIFICADO: clearSessionData() incluyendo contador
  private clearSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForDreams_traumdeutung');
    sessionStorage.removeItem('dreamMessages');
    sessionStorage.removeItem('dreamBlockedMessageId');
    sessionStorage.removeItem('dreamUserMessageCount');
    sessionStorage.removeItem('freeDreamConsultations');
    sessionStorage.removeItem('pendingDreamMessage');
  }

  isMessageBlocked(message: ConversationMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForDreams;
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

    if (this.messageText?.trim()) {
      sessionStorage.setItem('pendingDreamMessage', this.messageText.trim());
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
        serviceName: 'Significado de Sueños',
        returnPath: '/significado-suenos',
        cancelPath: '/significado-suenos',
      });
    } catch (error: any) {
      this.paymentError =
        error.message || 'Error al inicializar el pago de PayPal.';
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

  adjustTextareaHeight(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, this.minTextareaHeight),
      this.maxTextareaHeight
    );
    this.textareaHeight = newHeight;
    textarea.style.height = newHeight + 'px';
  }

  // ✅ MODIFICADO: newConsultation() reseteando contador
  newConsultation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForDreams) {
      this.userMessageCount = 0;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('dreamMessages');
      sessionStorage.removeItem('dreamBlockedMessageId');
      sessionStorage.removeItem('dreamUserMessageCount');
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
      role: 'interpreter',
      message: `🔮 Las energías cósmicas están perturbadas... ${errorMessage} Intenta de nuevo cuando las vibraciones se estabilicen.`,
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
      if (this.messageText?.trim() && !this.isLoading) {
        this.sendMessage();
        setTimeout(() => {
          this.textareaHeight = this.minTextareaHeight;
        }, 50);
      }
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

  onUserDataSubmitted(userData: any): void {
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `Para continuar con el pago, debes completar los siguientes campos: ${missingFields.join(
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

  openDataModalForPayment(): void {
    this.showFortuneWheel = false;
    this.showPaymentModal = false;
    this.saveStateBeforePayment();

    setTimeout(() => {
      this.showDataModal = true;
      this.cdr.markForCheck();
    }, 100);
  }

  getDreamConsultationsCount(): number {
    return parseInt(sessionStorage.getItem('freeDreamConsultations') || '0');
  }

  getPrizesAvailable(): string {
    const prizes: string[] = [];

    const freeConsultations = parseInt(
      sessionStorage.getItem('freeDreamConsultations') || '0'
    );
    if (freeConsultations > 0) {
      prizes.push(
        `${freeConsultations} interpretación${
          freeConsultations > 1 ? 'es' : ''
        } gratis`
      );
    }

    return prizes.length > 0 ? prizes.join(', ') : 'Ninguno';
  }
}

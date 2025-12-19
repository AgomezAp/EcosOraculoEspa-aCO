import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
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
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  InformacionZodiacoService,
  ZodiacRequest,
  ZodiacResponse,
  AstrologerData,
} from '../../services/informacion-zodiaco.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { PaypalService } from '../../services/paypal.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';

interface ZodiacMessage {
  content: string;
  isUser: boolean;
  timestamp: Date;
  sender?: string;
  id?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  isCompleteResponse?: boolean;
  isPrizeAnnouncement?: boolean;
}

@Component({
  selector: 'app-informacion-zodiaco',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './informacion-zodiaco.component.html',
  styleUrl: './informacion-zodiaco.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformacionZodiacoComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  currentMessage: string = '';
  messages: ZodiacMessage[] = [];
  isLoading = false;
  hasStartedConversation = false;

  // Variables de control de scroll
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Variables para modal de datos
  showDataModal: boolean = false;
  userData: any = null;

  // Variables para control de pagos
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForAstrology: boolean = false;

  // ✅ NUEVO: Sistema de 3 mensajes gratis
  private userMessageCount: number = 0;
  private readonly FREE_MESSAGES_LIMIT = 3;

  // Configuración de la rueda de la fortuna
  showFortuneWheel: boolean = false;
  astralPrizes: Prize[] = [
    {
      id: '1',
      name: '3 lanzamientos de la Rueda Astral',
      color: '#4ecdc4',
      icon: '🔮',
    },
    { id: '2', name: '1 Lectura Premium Astral', color: '#45b7d1', icon: '✨' },
    {
      id: '4',
      name: '¡Intenta de nuevo!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];

  private wheelTimer: any;
  blockedMessageId: string | null = null;
  private backendUrl = environment.apiUrl;

  astrologerInfo = {
    name: 'Maestra Carla',
    title: 'Guardiana de las Estrellas',
    specialty: 'Especialista en Astrología y Signos del Zodiaco',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Bienvenido, alma cósmica. Las estrellas me susurraron tu llegada... ¿Qué secretos del zodiaco quieres descifrar hoy?',
    'Los planetas se alinean para recibirte. Soy la Maestra Carla, intérprete de los destinos celestiales. ¿Sobre qué quieres consultar respecto a tu signo zodiacal o aspecto celestial?',
    'El universo vibra con tu presencia... Las constelaciones danzan y esperan tus preguntas. Permíteme guiarte a través de los caminos del zodiaco.',
    'Ah, veo que las estrellas te han guiado hacia mí. Los secretos de los signos del zodiaco aguardan ser revelados. ¿Qué te inquieta en el firmamento?',
  ];

  constructor(
    private http: HttpClient,
    private zodiacoService: InformacionZodiacoService,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    @Optional() public dialogRef: MatDialogRef<InformacionZodiacoComponent>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService
  ) {}

  async ngOnInit(): Promise<void> {
    // Cargar estado de pago
    this.hasUserPaidForAstrology =
      sessionStorage.getItem('hasUserPaidForZodiacInfo_zodiacInfo') === 'true';

    // ✅ NUEVO: Cargar contador de mensajes
    const savedMessageCount = sessionStorage.getItem('zodiacUserMessageCount');
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
          this.hasUserPaidForAstrology = true;
          sessionStorage.setItem('hasUserPaidForZodiacInfo_zodiacInfo', 'true');
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('astrologyBlockedMessageId');

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          this.messages.push({
            sender: this.astrologerInfo.name,
            content:
              '✨ ¡Pago confirmado! Ahora puedes acceder a toda mi experiencia y sabiduría celestial sin límites.',
            timestamp: new Date(),
            isUser: false,
          });

          this.cdr.markForCheck();
        }
      } catch (error) {
        this.paymentError = 'Error en la verificación del pago';
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
    const savedMessages = sessionStorage.getItem('astrologyMessages');
    const savedBlockedMessageId = sessionStorage.getItem(
      'astrologyBlockedMessageId'
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

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  // ✅ NUEVO: Obtener mensajes gratis restantes
  getFreeMessagesRemaining(): number {
    if (this.hasUserPaidForAstrology) {
      return -1; // Ilimitado
    }
    return Math.max(0, this.FREE_MESSAGES_LIMIT - this.userMessageCount);
  }

  // ✅ NUEVO: Verificar si tiene acceso
  private hasAccess(): boolean {
    // Premium = acceso ilimitado
    if (this.hasUserPaidForAstrology) {
      return true;
    }

    // Tiene consultas gratis de la ruleta
    if (this.hasFreeAstrologyConsultationsAvailable()) {
      return true;
    }

    // Dentro del límite de mensajes gratis
    if (this.userMessageCount < this.FREE_MESSAGES_LIMIT) {
      return true;
    }

    return false;
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
    const prizeMessage: ZodiacMessage = {
      isUser: false,
      content: `🌟 ¡Las energías cósmicas te han bendecido! Has ganado: **${prize.name}** ${prize.icon}\n\nEste regalo del universo ha sido activado para ti. Los secretos del zodiaco te serán revelados con mayor claridad. ¡Que la fortuna astral te acompañe en tus próximas consultas!`,
      timestamp: new Date(),
      isPrizeAnnouncement: true,
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    this.processAstralPrize(prize);
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

  private processAstralPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Consultas Gratis
        this.addFreeAstrologyConsultations(3);
        break;
      case '2': // 1 Lectura Premium - ACCESO COMPLETO
        this.hasUserPaidForAstrology = true;
        sessionStorage.setItem('hasUserPaidForZodiacInfo_zodiacInfo', 'true');

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('astrologyBlockedMessageId');
        }

        const premiumMessage: ZodiacMessage = {
          isUser: false,
          content:
            '✨ **¡Has desbloqueado el acceso Premium completo!** ✨\n\nLas estrellas se han alineado de manera extraordinaria para ayudarte. Ahora tienes acceso ilimitado a todo el conocimiento astral. Puedes consultar signos del zodiaco, compatibilidades, predicciones astrológicas y todos los secretos celestiales tantas veces como desees.\n\n🌟 *Las estrellas han abierto todas sus puertas cósmicas para ti* 🌟',
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

  private addFreeAstrologyConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeAstrologyConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForAstrology) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('astrologyBlockedMessageId');
    }

    // Mensaje informativo
    const infoMessage: ZodiacMessage = {
      isUser: false,
      content: `✨ *Has recibido ${count} consultas astrales gratuitas* ✨\n\nAhora tienes **${newTotal}** consultas disponibles para explorar los misterios del zodiaco.`,
      timestamp: new Date(),
    };
    this.messages.push(infoMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
  }

  private hasFreeAstrologyConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeAstrologyConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeAstrologyConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem(
        'freeAstrologyConsultations',
        remaining.toString()
      );

      const prizeMsg: ZodiacMessage = {
        isUser: false,
        content: `✨ *Has utilizado una consulta astral gratuita* ✨\n\nTe quedan **${remaining}** consultas astrales gratuitas.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
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

      const welcomeMessage: ZodiacMessage = {
        isUser: false,
        content: randomWelcome,
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
    if (this.currentMessage?.trim() && !this.isLoading) {
      const userMessage = this.currentMessage.trim();

      // Calcular el próximo número de mensaje
      const nextMessageCount = this.userMessageCount + 1;

      console.log(
        `📊 Mensaje #${nextMessageCount}, Premium: ${this.hasUserPaidForAstrology}, Límite: ${this.FREE_MESSAGES_LIMIT}`
      );

      // ✅ Verificar acceso
      const canSendMessage =
        this.hasUserPaidForAstrology ||
        this.hasFreeAstrologyConsultationsAvailable() ||
        nextMessageCount <= this.FREE_MESSAGES_LIMIT;

      if (!canSendMessage) {
        console.log('❌ Sin acceso - mostrando modal de pago');

        // Cerrar otros modales
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Guardar mensaje pendiente
        sessionStorage.setItem('pendingAstrologyMessage', userMessage);
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
        !this.hasUserPaidForAstrology &&
        nextMessageCount > this.FREE_MESSAGES_LIMIT &&
        this.hasFreeAstrologyConsultationsAvailable()
      ) {
        this.useFreeAstrologyConsultation();
      }

      this.shouldAutoScroll = true;
      this.processUserMessage(userMessage, nextMessageCount);
    }
  }

  // ✅ MODIFICADO: processUserMessage() para enviar messageCount al backend
  private processUserMessage(userMessage: string, messageCount: number): void {
    // Agregar mensaje del usuario
    const userMsg: ZodiacMessage = {
      isUser: true,
      content: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    // ✅ Actualizar contador
    this.userMessageCount = messageCount;
    sessionStorage.setItem(
      'zodiacUserMessageCount',
      this.userMessageCount.toString()
    );

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    // ✅ Generar respuesta con messageCount
    this.generateAstrologyResponse(userMessage, messageCount).subscribe({
      next: (response: ZodiacResponse) => {
        this.isLoading = false;

        const messageId = Date.now().toString();
        const astrologerMsg: ZodiacMessage = {
          isUser: false,
          content: response.response || '',
          timestamp: new Date(),
          id: messageId,
          freeMessagesRemaining: response.freeMessagesRemaining,
          showPaywall: response.showPaywall,
          isCompleteResponse: response.isCompleteResponse,
        };
        this.messages.push(astrologerMsg);

        this.shouldAutoScroll = true;

        console.log(
          `📊 Respuesta - Mensajes restantes: ${response.freeMessagesRemaining}, Paywall: ${response.showPaywall}, Completa: ${response.isCompleteResponse}`
        );

        // ✅ Mostrar paywall si el backend lo indica
        if (response.showPaywall && !this.hasUserPaidForAstrology) {
          this.blockedMessageId = messageId;
          sessionStorage.setItem('astrologyBlockedMessageId', messageId);

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
      },
      error: (error: any) => {
        this.isLoading = false;
        console.error('Error en respuesta:', error);

        const errorMsg: ZodiacMessage = {
          isUser: false,
          content:
            '🌟 Disculpa, las energías cósmicas están temporalmente perturbadas. Por favor, intenta de nuevo en unos momentos.',
          timestamp: new Date(),
        };
        this.messages.push(errorMsg);
        this.saveMessagesToSession();
        this.cdr.markForCheck();
      },
    });
  }

  // ✅ MODIFICADO: generateAstrologyResponse() para incluir messageCount y isPremiumUser
  private generateAstrologyResponse(
    userMessage: string,
    messageCount: number
  ): Observable<ZodiacResponse> {
    // Crear historial de conversación
    const conversationHistory = this.messages
      .filter(
        (msg) =>
          msg.content &&
          msg.content.trim() !== '' &&
          !msg.isPrizeAnnouncement
      )
      .slice(-10) // Últimos 10 mensajes para contexto
      .map((msg) => ({
        role: msg.isUser ? ('user' as const) : ('astrologer' as const),
        message: msg.content,
      }));

    // Datos del astrólogo
    const astrologerData: AstrologerData = {
      name: this.astrologerInfo.name,
      title: this.astrologerInfo.title,
      specialty: this.astrologerInfo.specialty,
      experience:
        'Siglos de experiencia en la interpretación de destinos celestiales e influencias de las estrellas',
    };

    // ✅ Request con messageCount y isPremiumUser
    const request: ZodiacRequest = {
      zodiacData: astrologerData,
      userMessage,
      conversationHistory,
      messageCount: messageCount,
      isPremiumUser: this.hasUserPaidForAstrology,
    };

    console.log('📤 Enviando request:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.zodiacoService.chatWithAstrologer(request).pipe(
      map((response: ZodiacResponse) => {
        console.log('📥 Respuesta recibida:', {
          success: response.success,
          freeMessagesRemaining: response.freeMessagesRemaining,
          showPaywall: response.showPaywall,
          isCompleteResponse: response.isCompleteResponse,
        });

        if (response.success) {
          return response;
        } else {
          throw new Error(response.error || 'Error desconocido del servicio');
        }
      }),
      catchError((error: any) => {
        console.error('Error en generateAstrologyResponse:', error);
        return of({
          success: true,
          response:
            '🌟 Las estrellas están temporalmente nubladas. Por favor, intenta de nuevo en unos momentos.',
          timestamp: new Date().toISOString(),
          freeMessagesRemaining: this.getFreeMessagesRemaining(),
          showPaywall: false,
          isCompleteResponse: true,
        });
      })
    );
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'zodiacUserMessageCount',
      this.userMessageCount.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem('astrologyBlockedMessageId', this.blockedMessageId);
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
        'astrologyMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  // ✅ MODIFICADO: clearSessionData() incluyendo contador
  private clearSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForZodiacInfo_zodiacInfo');
    sessionStorage.removeItem('astrologyMessages');
    sessionStorage.removeItem('astrologyBlockedMessageId');
    sessionStorage.removeItem('zodiacUserMessageCount');
    sessionStorage.removeItem('freeAstrologyConsultations');
    sessionStorage.removeItem('pendingAstrologyMessage');
  }

  isMessageBlocked(message: any): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForAstrology
    );
  }

  async promptForPayment(): Promise<void> {
    this.showPaymentModal = true;
    this.cdr.markForCheck();
    this.paymentError = null;
    this.isProcessingPayment = false;

    // Validar datos de usuario
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
        'Se requiere correo electrónico. Por favor, complete el formulario.';
      this.showPaymentModal = false;
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    if (this.currentMessage) {
      sessionStorage.setItem('pendingZodiacInfoMessage', this.currentMessage);
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
        serviceName: 'Información Zodiacal Premium',
        returnPath: '/Informacion-zodiaco',
        cancelPath: '/Informacion-zodiaco',
      });
    } catch (error: any) {
      this.paymentError =
        error.message || 'Error al iniciar el pago de PayPal.';
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

  // ✅ MODIFICADO: clearConversation() reseteando contador
  clearConversation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForAstrology) {
      this.userMessageCount = 0;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('astrologyMessages');
      sessionStorage.removeItem('astrologyBlockedMessageId');
      sessionStorage.removeItem('zodiacUserMessageCount');
      this.userMessageCount = 0;
      this.blockedMessageId = null;
    }

    this.messages = [];
    this.hasStartedConversation = false;
    this.startConversation();
    this.cdr.markForCheck();
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {}
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    // Convertir **texto** a <strong>texto</strong>
    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Convertir saltos de línea a <br>
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // Convertir *texto* a cursiva
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
}
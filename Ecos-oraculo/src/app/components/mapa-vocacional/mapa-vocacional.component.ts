import { CommonModule } from '@angular/common';
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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepperModule } from '@angular/material/stepper';
import { MapaVocacionalService, VocationalResponse } from '../../services/mapa-vocacional.service';
import { PaypalService } from '../../services/paypal.service';
import { HttpClient } from '@angular/common/http';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  isCompleteResponse?: boolean;
  isPrizeAnnouncement?: boolean;
}
interface AssessmentQuestion {
  id: number;
  question: string;
  options: Array<{
    value: string;
    label: string;
    category: string;
  }>;
}

interface AssessmentAnswer {
  question: string;
  answer: string;
  category: string;
}

interface PersonalInfo {
  age?: number;
  currentEducation?: string;
  workExperience?: string;
  interests?: string[];
}

interface VocationalProfile {
  name: string;
  description: string;
  characteristics: string[];
  workEnvironments: string[];
}

@Component({
  selector: 'app-mapa-vocacional',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatRadioModule,
    MatStepperModule,
    MatProgressBarModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './mapa-vocacional.component.html',
  styleUrl: './mapa-vocacional.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaVocacionalComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  // Info del consejero
  counselorInfo = {
    name: 'Dra. Valeria',
    title: 'Especialista en Orientación Profesional',
    specialty: 'Orientación profesional y cartas de carrera personalizadas',
  };

  // Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;

  // Estado de pestañas
  currentTab: 'chat' | 'assessment' | 'results' = 'chat';

  // Chat
  chatMessages: ChatMessage[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;

  // Variables para auto-scroll
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Variables para control de pagos con PayPal
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForVocational: boolean = false;
  blockedMessageId: string | null = null;

  // ✅ NUEVO: Sistema de 3 mensajes gratis
  private userMessageCount: number = 0;
  private readonly FREE_MESSAGES_LIMIT = 3;

  // Variables para la ruleta
  showFortuneWheel: boolean = false;
  vocationalPrizes: Prize[] = [
    {
      id: '1',
      name: '3 consultas gratuitas',
      color: '#4ecdc4',
      icon: '🎯',
    },
    {
      id: '2',
      name: '1 Análisis Premium de Carrera',
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

  // Datos personales
  showPersonalForm: boolean = false;
  personalInfo: PersonalInfo = {};

  // Assessment
  assessmentQuestions: AssessmentQuestion[] = [];
  currentQuestionIndex: number = 0;
  selectedOption: string = '';
  assessmentAnswers: AssessmentAnswer[] = [];
  assessmentProgress: number = 0;
  hasAssessmentResults: boolean = false;
  assessmentResults: any = null;

  constructor(
    private vocationalService: MapaVocacionalService,
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
    this.hasUserPaidForVocational =
      sessionStorage.getItem('hasUserPaidForVocational_berufskarte') === 'true';

    // ✅ NUEVO: Cargar contador de mensajes
    const savedMessageCount = sessionStorage.getItem('vocationalUserMessageCount');
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
          this.hasUserPaidForVocational = true;
          sessionStorage.setItem('hasUserPaidForVocational_berufskarte', 'true');
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('vocationalBlockedMessageId');

          window.history.replaceState({}, document.title, window.location.pathname);

          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;
          this.cdr.markForCheck();

          setTimeout(() => {
            this.addMessage({
              sender: this.counselorInfo.name,
              content:
                '🎉 ¡Pago completado exitosamente!\n\n' +
                '✨ Gracias por tu pago. Ahora tienes acceso completo a la Carta de Carrera.\n\n' +
                '💼 ¡Descubramos juntos tu futuro profesional!\n\n' +
                '📌 Nota: Este pago es válido solo para el servicio de Carta de Carrera.',
              timestamp: new Date(),
              isUser: false,
            });
            this.cdr.detectChanges();
            setTimeout(() => {
              this.scrollToBottom();
              this.cdr.markForCheck();
            }, 200);
          }, 1000);
        } else {
          this.paymentError = 'No se pudo verificar el pago.';
          setTimeout(() => {
            this.addMessage({
              sender: this.counselorInfo.name,
              content:
                '⚠️ Hubo un problema al verificar tu pago. Por favor, intenta de nuevo o contacta con nuestro soporte.',
              timestamp: new Date(),
              isUser: false,
            });
            this.cdr.detectChanges();
          }, 800);
        }
      } catch (error) {
        console.error('Error verificando pago de PayPal:', error);
        this.paymentError = 'Error en la verificación del pago';
        setTimeout(() => {
          this.addMessage({
            sender: this.counselorInfo.name,
            content:
              '❌ Lamentablemente, ocurrió un error al verificar tu pago. Por favor, intenta de nuevo más tarde.',
            timestamp: new Date(),
            isUser: false,
          });
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
    const savedMessages = sessionStorage.getItem('vocationalMessages');
    const savedBlockedMessageId = sessionStorage.getItem('vocationalBlockedMessageId');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.chatMessages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.blockedMessageId = savedBlockedMessageId || null;
      } catch (error) {
        console.error('Error parseando mensajes:', error);
      }
    }

    // Solo agregar mensaje de bienvenida si no hay mensajes guardados
    if (this.chatMessages.length === 0) {
      this.initializeWelcomeMessage();
    }

    this.loadAssessmentQuestions();

    if (this.chatMessages.length > 0 && FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(2000);
    }
  }

  // ✅ NUEVO: Obtener mensajes gratis restantes
  getFreeMessagesRemaining(): number {
    if (this.hasUserPaidForVocational) {
      return -1; // Ilimitado
    }
    return Math.max(0, this.FREE_MESSAGES_LIMIT - this.userMessageCount);
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.chatMessages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.chatMessages.length;
    }
  }

  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50;
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    this.shouldAutoScroll = isNearBottom;
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  initializeWelcomeMessage(): void {
    this.addMessage({
      sender: this.counselorInfo.name,
      content: `¡Hola! Soy ${this.counselorInfo.name}, tu especialista en Orientación Profesional. Estoy aquí para ayudarte a descubrir tu verdadera vocación y diseñar una carta de carrera personalizada para ti.`,
      timestamp: new Date(),
      isUser: false,
    });
    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    }
  }

  switchTab(tab: 'chat' | 'assessment' | 'results'): void {
    this.currentTab = tab;
  }

  // ✅ MODIFICADO: sendMessage() con sistema de 3 mensajes gratis
  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    // Calcular el próximo número de mensaje
    const nextMessageCount = this.userMessageCount + 1;

    console.log(
      `📊 Vocacional - Mensaje #${nextMessageCount}, Premium: ${this.hasUserPaidForVocational}, Límite: ${this.FREE_MESSAGES_LIMIT}`
    );

    // ✅ Verificar acceso
    const canSendMessage =
      this.hasUserPaidForVocational ||
      this.hasFreeVocationalConsultationsAvailable() ||
      nextMessageCount <= this.FREE_MESSAGES_LIMIT;

    if (!canSendMessage) {
      console.log('❌ Sin acceso - mostrando modal de pago');

      // Cerrar otros modales
      this.showFortuneWheel = false;
      this.showPaymentModal = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingVocationalMessage', userMessage);
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
      !this.hasUserPaidForVocational &&
      nextMessageCount > this.FREE_MESSAGES_LIMIT &&
      this.hasFreeVocationalConsultationsAvailable()
    ) {
      this.useFreeVocationalConsultation();
    }

    this.shouldAutoScroll = true;
    this.processUserMessage(userMessage, nextMessageCount);
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'vocationalUserMessageCount',
      this.userMessageCount.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem('vocationalBlockedMessageId', this.blockedMessageId);
    }
  }

  // ✅ MODIFICADO: processUserMessage() para enviar messageCount al backend
  private processUserMessage(userMessage: string, messageCount: number): void {
    this.addMessage({
      sender: 'Tú',
      content: userMessage,
      timestamp: new Date(),
      isUser: true,
    });

    // ✅ Actualizar contador
    this.userMessageCount = messageCount;
    sessionStorage.setItem(
      'vocationalUserMessageCount',
      this.userMessageCount.toString()
    );

    this.currentMessage = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    // Preparar historial de conversación
    const conversationHistory = this.chatMessages
      .filter((msg) => msg.content && !msg.isPrizeAnnouncement)
      .slice(-10)
      .map((msg) => ({
        role: msg.isUser ? ('user' as const) : ('counselor' as const),
        message: msg.content,
      }));

    // ✅ Usar el nuevo método con messageCount
    this.vocationalService
      .sendMessageWithCount(
        userMessage,
        messageCount,
        this.hasUserPaidForVocational,
        this.personalInfo,
        this.assessmentAnswers,
        conversationHistory
      )
      .subscribe({
        next: (response: VocationalResponse) => {
          this.isLoading = false;

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            this.addMessage({
              sender: this.counselorInfo.name,
              content: response.response,
              timestamp: new Date(),
              isUser: false,
              id: messageId,
              freeMessagesRemaining: response.freeMessagesRemaining,
              showPaywall: response.showPaywall,
              isCompleteResponse: response.isCompleteResponse,
            });

            console.log(
              `📊 Respuesta - Mensajes restantes: ${response.freeMessagesRemaining}, Paywall: ${response.showPaywall}, Completa: ${response.isCompleteResponse}`
            );

            // ✅ Mostrar paywall si el backend lo indica
            if (response.showPaywall && !this.hasUserPaidForVocational) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('vocationalBlockedMessageId', messageId);

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
            this.addMessage({
              sender: this.counselorInfo.name,
              content:
                response.error ||
                'Disculpa, estoy experimentando dificultades técnicas. ¿Podrías reformular tu pregunta?',
              timestamp: new Date(),
              isUser: false,
            });
            this.saveMessagesToSession();
            this.cdr.markForCheck();
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error en respuesta:', error);
          this.addMessage({
            sender: this.counselorInfo.name,
            content:
              'Disculpa, estoy experimentando dificultades técnicas. ¿Podrías reformular tu pregunta?',
            timestamp: new Date(),
            isUser: false,
          });
          this.saveMessagesToSession();
          this.cdr.markForCheck();
        },
      });
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.chatMessages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem('vocationalMessages', JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForVocational;
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

    if (this.currentMessage) {
      sessionStorage.setItem('pendingVocationalMessage', this.currentMessage);
    }
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
    const prizeMessage: ChatMessage = {
      sender: this.counselorInfo.name,
      content: `🎯 ¡Excelente! El destino profesional te ha bendecido. Has ganado: **${prize.name}** ${prize.icon}\n\nEste regalo del universo profesional ha sido activado para ti. Las oportunidades de carrera se alinean a tu favor. ¡Que esta fortuna te guíe hacia tu verdadera vocación!`,
      timestamp: new Date(),
      isUser: false,
      isPrizeAnnouncement: true,
    };

    this.chatMessages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    this.processVocationalPrize(prize);
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
      alert('No tienes giros disponibles. ' + FortuneWheelComponent.getSpinStatus());
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processVocationalPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Sesiones Gratis
        this.addFreeVocationalConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.hasUserPaidForVocational = true;
        sessionStorage.setItem('hasUserPaidForVocational_berufskarte', 'true');

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('vocationalBlockedMessageId');
        }

        const premiumMessage: ChatMessage = {
          sender: this.counselorInfo.name,
          content:
            '✨ **¡Has desbloqueado el acceso Premium completo!** ✨\n\nEl destino profesional te ha sonreído de manera extraordinaria. Ahora tienes acceso ilimitado a toda mi experiencia en orientación profesional. Puedes consultar sobre tu vocación, evaluaciones de carrera y todos los aspectos de tu futuro profesional tantas veces como desees.\n\n🎯 *Las puertas de tu camino profesional se han abierto completamente* 🎯',
          timestamp: new Date(),
          isUser: false,
        };
        this.chatMessages.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      case '4': // Otra oportunidad
        break;
      default:
    }
  }

  private addFreeVocationalConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeVocationalConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeVocationalConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForVocational) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('vocationalBlockedMessageId');
    }

    // Mensaje informativo
    const infoMessage: ChatMessage = {
      sender: this.counselorInfo.name,
      content: `✨ *Has recibido ${count} consultas vocacionales gratuitas* ✨\n\nAhora tienes **${newTotal}** consultas disponibles para explorar tu futuro profesional.`,
      timestamp: new Date(),
      isUser: false,
    };
    this.chatMessages.push(infoMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
  }

  private hasFreeVocationalConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeVocationalConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeVocationalConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeVocationalConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem('freeVocationalConsultations', remaining.toString());

      const prizeMsg: ChatMessage = {
        sender: this.counselorInfo.name,
        content: `✨ *Has utilizado una consulta gratuita* ✨\n\nTe quedan **${remaining}** consultas gratuitas disponibles.`,
        timestamp: new Date(),
        isUser: false,
      };
      this.chatMessages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      const orderData = {
        amount: '4.00',
        currency: 'EUR',
        serviceName: 'Mapa Vocacional',
        returnPath: '/mapa-vocacional',
        cancelPath: '/mapa-vocacional',
      };

      await this.paypalService.initiatePayment(orderData);
    } catch (error: any) {
      this.paymentError = error.message || 'Error al inicializar el pago de PayPal.';
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

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  addMessage(message: ChatMessage): void {
    this.chatMessages.push(message);
    this.shouldAutoScroll = true;
    setTimeout(() => this.scrollToBottom(), 100);
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;
    formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  togglePersonalForm(): void {
    this.showPersonalForm = !this.showPersonalForm;
  }

  savePersonalInfo(): void {
    this.showPersonalForm = false;

    if (Object.keys(this.personalInfo).length > 0) {
      this.addMessage({
        sender: this.counselorInfo.name,
        content: `Perfecto, he registrado tu información personal. Esto me ayudará a brindarte una orientación más precisa y personalizada. ¿Hay algo específico sobre tu futuro profesional que te preocupe o entusiasme?`,
        timestamp: new Date(),
        isUser: false,
      });
    }
  }

  loadAssessmentQuestions(): void {
    this.vocationalService.getAssessmentQuestions().subscribe({
      next: (questions) => {
        this.assessmentQuestions = questions;
        this.updateProgress();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error cargando preguntas:', error);
        this.cdr.markForCheck();
      },
    });
  }

  get currentQuestion(): AssessmentQuestion | null {
    return this.assessmentQuestions[this.currentQuestionIndex] || null;
  }

  selectOption(option: any): void {
    this.selectedOption = option.value;
  }

  nextQuestion(): void {
    if (this.selectedOption && this.currentQuestion) {
      this.assessmentAnswers[this.currentQuestionIndex] = {
        question: this.currentQuestion.question,
        answer: this.selectedOption,
        category:
          this.currentQuestion.options.find(
            (o: any) => o.value === this.selectedOption
          )?.category || '',
      };

      this.currentQuestionIndex++;
      this.selectedOption = '';
      this.updateProgress();
    }
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      const savedAnswer = this.assessmentAnswers[this.currentQuestionIndex];
      this.selectedOption = savedAnswer ? savedAnswer.answer : '';
      this.updateProgress();
    }
  }

  updateProgress(): void {
    if (this.assessmentQuestions.length > 0) {
      this.assessmentProgress =
        ((this.currentQuestionIndex + 1) / this.assessmentQuestions.length) * 100;
    }
  }

  finishAssessment(): void {
    if (this.selectedOption && this.currentQuestion) {
      this.assessmentAnswers[this.currentQuestionIndex] = {
        question: this.currentQuestion.question,
        answer: this.selectedOption,
        category:
          this.currentQuestion.options.find(
            (o: any) => o.value === this.selectedOption
          )?.category || '',
      };

      this.analyzeResults();
    }
  }

  analyzeResults(): void {
    this.vocationalService.analyzeAssessment(this.assessmentAnswers).subscribe({
      next: (results) => {
        this.assessmentResults = results;
        this.hasAssessmentResults = true;
        this.switchTab('results');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error analizando resultados:', error);
        this.cdr.markForCheck();
      },
    });
  }

  startNewAssessment(): void {
    this.currentQuestionIndex = 0;
    this.selectedOption = '';
    this.assessmentAnswers = [];
    this.assessmentProgress = 0;
    this.assessmentResults = null;
    this.hasAssessmentResults = false;
    this.updateProgress();
    this.switchTab('assessment');
  }

  getCategoryEmoji(category: string): string {
    return this.vocationalService.getCategoryEmoji(category);
  }

  getCategoryColor(category: string): string {
    return this.vocationalService.getCategoryColor(category);
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {}
  }

  onUserDataSubmitted(userData: any): void {
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `Para continuar con el pago, debes completar los siguientes campos: ${missingFields.join(', ')}`
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
    this.http.post(`${environment.apiUrl}api/recolecta`, userData).subscribe({
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

  // ✅ MODIFICADO: resetChat() incluyendo contador
  resetChat(): void {
    this.chatMessages = [];
    this.currentMessage = '';
    this.isLoading = false;
    this.blockedMessageId = null;

    // ✅ Resetear contador de mensajes
    this.userMessageCount = 0;

    this.showPaymentModal = false;
    this.showDataModal = false;
    this.showFortuneWheel = false;
    this.showPersonalForm = false;

    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    this.currentQuestionIndex = 0;
    this.selectedOption = '';
    this.assessmentAnswers = [];
    this.assessmentProgress = 0;
    this.assessmentResults = null;
    this.hasAssessmentResults = false;

    this.personalInfo = {};

    this.isProcessingPayment = false;
    this.paymentError = null;

    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    // ✅ Limpiar sessionStorage incluyendo contador
    sessionStorage.removeItem('vocationalMessages');
    sessionStorage.removeItem('vocationalBlockedMessageId');
    sessionStorage.removeItem('vocationalUserMessageCount');
    sessionStorage.removeItem('pendingVocationalMessage');
    sessionStorage.removeItem('freeVocationalConsultations');

    this.currentTab = 'chat';

    this.initializeWelcomeMessage();
    this.cdr.markForCheck();
  }
}
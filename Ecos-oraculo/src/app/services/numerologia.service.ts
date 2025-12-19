import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environmets.prod';

// ✅ Interface para los datos del numerólogo
interface NumerologyData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

// ✅ Interface del Request - EXPORTADA
export interface NumerologyRequest {
  numerologyData: NumerologyData;
  userMessage: string;
  birthDate?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: 'user' | 'numerologist';
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

// ✅ Interface del Response - EXPORTADA
export interface NumerologyResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

// ✅ Interface para información del numerólogo - EXPORTADA
export interface NumerologyInfo {
  success: boolean;
  numerologist: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit?: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class NumerologiaService {
  private appUrl: string;
  private apiUrl: string;

  // Datos por defecto del numerólogo
  private defaultNumerologyData: NumerologyData = {
    name: 'Maestra Sofía',
    title: 'Guardiana de los Números Sagrados',
    specialty: 'Numerología pitagórica',
    experience:
      'Décadas de experiencia en las vibraciones numéricas del universo',
  };

  constructor(private http: HttpClient) {
    this.appUrl = environment.apiUrl;
    this.apiUrl = 'api/numerology';
  }

  /**
   * ✅ MÉTODO PRINCIPAL: Enviar mensaje con contador de mensajes
   */
  sendMessageWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    birthDate?: string,
    fullName?: string,
    conversationHistory?: Array<{
      role: 'user' | 'numerologist';
      message: string;
    }>
  ): Observable<NumerologyResponse> {
    const request: NumerologyRequest = {
      numerologyData: this.defaultNumerologyData,
      userMessage: userMessage.trim(),
      birthDate,
      fullName,
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Enviando mensaje al numerólogo:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<NumerologyResponse>(
        `${this.appUrl}${this.apiUrl}/numerologist`,
        request
      )
      .pipe(
        timeout(60000),
        map((response: NumerologyResponse) => {
          console.log('📥 Respuesta del numerólogo:', {
            success: response.success,
            freeMessagesRemaining: response.freeMessagesRemaining,
            showPaywall: response.showPaywall,
            isCompleteResponse: response.isCompleteResponse,
          });

          if (response.success) {
            return response;
          }
          throw new Error(response.error || 'Respuesta inválida del servidor');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error en comunicación con numerólogo:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as NumerologyResponse);
        })
      );
  }

  /**
   * Método legacy para compatibilidad
   */
  sendMessage(
    userMessage: string,
    birthDate?: string,
    fullName?: string,
    conversationHistory?: Array<{
      role: 'user' | 'numerologist';
      message: string;
    }>
  ): Observable<string> {
    const request: NumerologyRequest = {
      numerologyData: this.defaultNumerologyData,
      userMessage: userMessage.trim(),
      birthDate,
      fullName,
      conversationHistory,
      messageCount: 1,
      isPremiumUser: false,
    };

    console.log(
      'Enviando mensaje al numerólogo (legacy):',
      this.apiUrl + '/numerologist'
    );

    return this.http
      .post<NumerologyResponse>(
        `${this.appUrl}${this.apiUrl}/numerologist`,
        request
      )
      .pipe(
        timeout(30000),
        map((response: NumerologyResponse) => {
          console.log('Respuesta del numerólogo:', response);
          if (response.success && response.response) {
            return response.response;
          }
          throw new Error(response.error || 'Respuesta inválida del servidor');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error en comunicación con numerólogo:', error);
          return of(this.getErrorMessage(error));
        })
      );
  }

  /**
   * Obtener información del numerólogo
   */
  getNumerologyInfo(): Observable<NumerologyInfo> {
    return this.http
      .get<NumerologyInfo>(`${this.appUrl}${this.apiUrl}/numerologist/info`)
      .pipe(
        timeout(10000),
        catchError((error: HttpErrorResponse) => {
          console.error('Error obteniendo info del numerólogo:', error);
          return of({
            success: false,
            numerologist: {
              name: 'Maestra Sofía',
              title: 'Guardiana de los Números Sagrados',
              specialty: 'Numerología pitagórica',
              description: 'Error al conectar con el numerólogo',
              services: [],
            },
            freeMessagesLimit: 3,
            timestamp: new Date().toISOString(),
          } as NumerologyInfo);
        })
      );
  }

  /**
   * Probar conexión con el backend
   */
  testConnection(): Observable<any> {
    return this.http.get(`${this.appUrl}api/health`).pipe(
      timeout(5000),
      catchError((error: HttpErrorResponse) => {
        console.error('Error de conexión:', error);
        return of({
          success: false,
          error: 'No se puede conectar con el servicio de numerología',
        });
      })
    );
  }

  /**
   * Calcular número del camino de vida
   */
  calculateLifePath(birthDate: string): number {
    try {
      const numbers = birthDate.replace(/\D/g, '');
      const sum = numbers
        .split('')
        .reduce((acc, digit) => acc + parseInt(digit), 0);
      return this.reduceToSingleDigit(sum);
    } catch {
      return 0;
    }
  }

  /**
   * Calcular número del destino basado en el nombre
   */
  calculateDestinyNumber(name: string): number {
    const letterValues: { [key: string]: number } = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      E: 5,
      F: 6,
      G: 7,
      H: 8,
      I: 9,
      J: 1,
      K: 2,
      L: 3,
      M: 4,
      N: 5,
      O: 6,
      P: 7,
      Q: 8,
      R: 9,
      S: 1,
      T: 2,
      U: 3,
      V: 4,
      W: 5,
      X: 6,
      Y: 7,
      Z: 8,
    };

    const sum = name
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .split('')
      .reduce((acc, letter) => {
        return acc + (letterValues[letter] || 0);
      }, 0);

    return this.reduceToSingleDigit(sum);
  }

  /**
   * Obtener interpretación básica de un número
   */
  getNumberMeaning(number: number): string {
    const meanings: { [key: number]: string } = {
      1: 'Liderazgo, independencia, pionero',
      2: 'Cooperación, diplomacia, sensibilidad',
      3: 'Creatividad, comunicación, expresión',
      4: 'Estabilidad, trabajo duro, organización',
      5: 'Libertad, aventura, cambio',
      6: 'Responsabilidad, cuidado, armonía',
      7: 'Espiritualidad, introspección, análisis',
      8: 'Poder material, ambición, logros',
      9: 'Humanitarismo, compasión, sabiduría',
      11: 'Inspiración, intuición, iluminación (Número Maestro)',
      22: 'Constructor maestro, visión práctica (Número Maestro)',
      33: 'Maestro sanador, servicio a la humanidad (Número Maestro)',
    };

    return meanings[number] || 'Número no reconocido';
  }

  /**
   * Método auxiliar para reducir a dígito único
   */
  private reduceToSingleDigit(num: number): number {
    while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
      num = num
        .toString()
        .split('')
        .reduce((acc, digit) => acc + parseInt(digit), 0);
    }
    return num;
  }

  /**
   * Manejo de errores HTTP
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 429) {
      return 'Has realizado muchas consultas. Por favor, espera un momento antes de continuar.';
    }

    if (error.status === 503) {
      return 'El servicio está temporalmente no disponible. Intenta de nuevo en unos minutos.';
    }

    if (error.status === 0) {
      return 'No se puede conectar con la maestra de numerología. Intenta de nuevo en unos minutos.';
    }

    if (error.error?.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Demasiadas solicitudes. Por favor, espera un momento.';
    }

    if (error.error?.code === 'MISSING_NUMEROLOGY_DATA') {
      return 'Error en los datos del numerólogo. Por favor, intenta nuevamente.';
    }

    if (error.error?.code === 'ALL_MODELS_UNAVAILABLE') {
      return 'Todos los modelos de IA están temporalmente no disponibles. Intenta de nuevo en unos minutos.';
    }

    return 'Disculpa, las energías numerológicas están bloqueadas en este momento. Te invito a meditar y a intentarlo más tarde.';
  }
}

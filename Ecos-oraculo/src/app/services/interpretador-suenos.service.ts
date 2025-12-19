import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environments';
export interface DreamInterpreterData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

export interface ConversationMessage {
  role: 'user' | 'interpreter';
  message: string;
  timestamp: Date | string;
  id?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  isCompleteResponse?: boolean;
  isPrizeAnnouncement?: boolean;
}

export interface DreamChatRequest {
  interpreterData: DreamInterpreterData;
  userMessage: string;
  conversationHistory?: ConversationMessage[];
  // ✅ NUEVOS CAMPOS para el sistema de 3 mensajes gratis
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface DreamChatResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp: string;
  // ✅ NUEVOS CAMPOS que devuelve el backend
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}
export interface InterpreterInfo {
  success: boolean;
  interpreter: {
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
export class InterpretadorSuenosService {
  private apiUrl = `${environment.apiUrl}`;

  // Datos por defecto del intérprete
  private defaultInterpreterData: DreamInterpreterData = {
    name: 'Maestra Alma',
    title: 'Guardiana de los Sueños',
    specialty: 'Interpretación de sueños y simbolismo onírico',
    experience: 'Siglos de experiencia interpretando mensajes del subconsciente',
  };

  constructor(private http: HttpClient) {}

  /**
   * ✅ MÉTODO PRINCIPAL: Enviar mensaje con contador de mensajes
   */
  chatWithInterpreterWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    conversationHistory?: ConversationMessage[]
  ): Observable<DreamChatResponse> {
    const request: DreamChatRequest = {
      interpreterData: this.defaultInterpreterData,
      userMessage: userMessage.trim(),
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Enviando mensaje de sueños:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<DreamChatResponse>(`${this.apiUrl}interpretador-sueno`, request)
      .pipe(
        timeout(60000),
        map((response: DreamChatResponse) => {
          console.log('📥 Respuesta de sueños:', {
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
          console.error('Error en comunicación con intérprete:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as DreamChatResponse);
        })
      );
  }

  /**
   * Método legacy para compatibilidad
   */
  chatWithInterpreter(request: DreamChatRequest): Observable<DreamChatResponse> {
    const fullRequest: DreamChatRequest = {
      ...request,
      interpreterData: request.interpreterData || this.defaultInterpreterData,
      messageCount: request.messageCount || 1,
      isPremiumUser: request.isPremiumUser || false,
    };

    return this.http
      .post<DreamChatResponse>(`${this.apiUrl}interpretador-sueno`, fullRequest)
      .pipe(
        timeout(30000),
        catchError((error: HttpErrorResponse) => {
          console.error('Error en chatWithInterpreter:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as DreamChatResponse);
        })
      );
  }

  /**
   * Obtener información del intérprete
   */
  getInterpreterInfo(): Observable<InterpreterInfo> {
    return this.http
      .get<InterpreterInfo>(`${this.apiUrl}interpretador-sueno/info`)
      .pipe(
        timeout(10000),
        catchError((error: HttpErrorResponse) => {
          console.error('Error obteniendo info del intérprete:', error);
          return of({
            success: false,
            interpreter: {
              name: 'Maestra Alma',
              title: 'Guardiana de los Sueños',
              specialty: 'Interpretación de sueños y simbolismo onírico',
              description: 'Error al conectar con el intérprete',
              services: [],
            },
            freeMessagesLimit: 3,
            timestamp: new Date().toISOString(),
          } as InterpreterInfo);
        })
      );
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
      return 'No se puede conectar con el intérprete de sueños. Intenta de nuevo en unos minutos.';
    }

    if (error.error?.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Demasiadas solicitudes. Por favor, espera un momento.';
    }

    if (error.error?.code === 'ALL_MODELS_UNAVAILABLE') {
      return 'Todos los modelos de IA están temporalmente no disponibles. Intenta de nuevo en unos minutos.';
    }

    return 'Disculpa, las energías oníricas están perturbadas en este momento. Intenta de nuevo más tarde.';
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../environments/environmets.prod';

// ✅ Interfaces actualizadas para el backend
export interface AstrologerData {
  name: string;
  title: string;
  specialty: string;
  experience: string;
}

export interface ZodiacRequest {
  zodiacData: AstrologerData;
  userMessage: string;
  birthDate?: string;
  zodiacSign?: string;
  conversationHistory?: Array<{
    role: 'user' | 'astrologer';
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface ZodiacResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export interface AstrologerInfoResponse {
  success: boolean;
  astrologer: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class InformacionZodiacoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Envía un mensaje al astrólogo y recibe una respuesta
   */
  chatWithAstrologer(request: ZodiacRequest): Observable<ZodiacResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    return this.http
      .post<ZodiacResponse>(`${this.apiUrl}api/zodiac/chat`, request, {
        headers,
      })
      .pipe(
        timeout(60000), // 60 segundos de timeout
        catchError((error) => {
          console.error('Error en chatWithAstrologer:', error);

          let errorMessage =
            'Error al comunicarse con el astrólogo. Por favor, intenta de nuevo.';
          let errorCode = 'NETWORK_ERROR';

          if (error.status === 429) {
            errorMessage =
              'Demasiadas consultas. Por favor, espera un momento antes de continuar.';
            errorCode = 'RATE_LIMIT';
          } else if (error.status === 503) {
            errorMessage =
              'El servicio está temporalmente no disponible. Intenta de nuevo en unos minutos.';
            errorCode = 'SERVICE_UNAVAILABLE';
          } else if (error.status === 400) {
            errorMessage =
              error.error?.error || 'Solicitud inválida. Verifica tu mensaje.';
            errorCode = error.error?.code || 'BAD_REQUEST';
          } else if (error.status === 401) {
            errorMessage = 'Error de autenticación con el servicio.';
            errorCode = 'AUTH_ERROR';
          } else if (error.name === 'TimeoutError') {
            errorMessage =
              'La consulta tardó demasiado. Por favor, intenta de nuevo.';
            errorCode = 'TIMEOUT';
          }

          return throwError(() => ({
            success: false,
            error: errorMessage,
            code: errorCode,
            timestamp: new Date().toISOString(),
          }));
        })
      );
  }

  /**
   * Obtiene información del astrólogo
   */
  getAstrologerInfo(): Observable<AstrologerInfoResponse> {
    return this.http
      .get<AstrologerInfoResponse>(`${this.apiUrl}api/zodiac/info`)
      .pipe(
        timeout(10000),
        catchError((error) => {
          console.error('Error en getAstrologerInfo:', error);
          return throwError(() => ({
            success: false,
            error: 'Error al obtener información del astrólogo',
            timestamp: new Date().toISOString(),
          }));
        })
      );
  }

  /**
   * Calcula el signo zodiacal basado en la fecha de nacimiento
   */
  calculateZodiacSign(birthDate: string): string {
    try {
      const date = new Date(birthDate);
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return 'Aries ♈';
      if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return 'Tauro ♉';
      if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return 'Géminis ♊';
      if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return 'Cáncer ♋';
      if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return 'Leo ♌';
      if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return 'Virgo ♍';
      if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return 'Libra ♎';
      if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return 'Escorpio ♏';
      if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return 'Sagitario ♐';
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return 'Capricornio ♑';
      if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return 'Acuario ♒';
      if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return 'Piscis ♓';

      return 'Signo desconocido';
    } catch {
      return 'Fecha inválida';
    }
  }
}

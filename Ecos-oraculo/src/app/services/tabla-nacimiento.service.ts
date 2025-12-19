import { Injectable } from '@angular/core';
import { environment } from '../environments/environments';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BirthChartRequest {
  chartData: {
    name: string;
    specialty: string;
    experience: string;
  };
  userMessage: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: 'user' | 'astrologer';
    message: string;
  }>;
  // ✅ NUEVOS CAMPOS para el sistema de 3 mensajes gratis
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface BirthChartResponse {
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

export interface AstrologerInfo {
  success: boolean;
  astrologer: {
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
  providedIn: 'root'
})
export class TablaNacimientoService {
  private apiUrl = `${environment.apiUrl}api/tabla-nacimiento`;

  constructor(private http: HttpClient) {}

  /**
   * ✅ MÉTODO PRINCIPAL: Enviar mensaje con contador de mensajes
   */
  chatWithAstrologerWithCount(
    request: BirthChartRequest,
    messageCount: number,
    isPremiumUser: boolean
  ): Observable<BirthChartResponse> {
    const fullRequest: BirthChartRequest = {
      ...request,
      messageCount,
      isPremiumUser,
    };
    return this.http.post<BirthChartResponse>(`${this.apiUrl}/chat`, fullRequest);
  }

  /**
   * Método legacy para compatibilidad
   */
  chatWithAstrologer(request: BirthChartRequest): Observable<BirthChartResponse> {
    return this.http.post<BirthChartResponse>(`${this.apiUrl}/chat`, request);
  }

  getBirthChartInfo(): Observable<AstrologerInfo> {
    return this.http.get<AstrologerInfo>(`${this.apiUrl}/info`);
  }
}
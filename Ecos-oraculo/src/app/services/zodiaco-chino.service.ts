import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

interface ChineseZodiacData {
  name: string;
  specialty: string;
  experience: string;
}

interface ChatMessage {
  role: 'user' | 'master';
  message: string;
  timestamp?: string;
}

interface ChineseZodiacRequest {
  zodiacData: ChineseZodiacData;
  userMessage: string;
  birthYear?: string;
  birthDate?: string;
  fullName?: string;
  conversationHistory?: ChatMessage[];
  // ✅ NUEVOS CAMPOS para el sistema de 3 mensajes gratis
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface ChatResponse {
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

interface MasterInfo {
  success: boolean;
  master: {
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
export class ZodiacoChinoService {
 private apiUrl = `${environment.apiUrl}api/zodiaco-chino`
  constructor(private http: HttpClient) {}

  getMasterInfo(): Observable<MasterInfo> {
    return this.http.get<MasterInfo>(`${this.apiUrl}/info`);
  }

  /**
   * ✅ MÉTODO PRINCIPAL: Enviar mensaje con contador de mensajes
   */
  chatWithMasterWithCount(
    request: ChineseZodiacRequest,
    messageCount: number,
    isPremiumUser: boolean
  ): Observable<ChatResponse> {
    const fullRequest: ChineseZodiacRequest = {
      ...request,
      messageCount,
      isPremiumUser,
    };

    return this.http.post<ChatResponse>(`${this.apiUrl}/chat`, fullRequest);
  }

  /**
   * Método legacy para compatibilidad
   */
  chatWithMaster(request: ChineseZodiacRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiUrl}/chat`, request);
  }
}

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environmets.prod';

// ✅ Interface para los datos del consejero vocacional
interface VocationalData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

// ✅ Interface del Request - EXPORTADA
export interface VocationalRequest {
  vocationalData: VocationalData;
  userMessage: string;
  personalInfo?: any;
  assessmentAnswers?: any[];
  conversationHistory?: Array<{
    role: 'user' | 'counselor';
    message: string;
  }>;
  // ✅ NUEVOS CAMPOS para el sistema de 3 mensajes gratis
  messageCount?: number;
  isPremiumUser?: boolean;
}

// ✅ Interface del Response - EXPORTADA
export interface VocationalResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
  // ✅ NUEVOS CAMPOS que devuelve el backend
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

// ✅ Interface para información del consejero - EXPORTADA
export interface CounselorInfo {
  success: boolean;
  counselor: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit?: number;
  timestamp: string;
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

interface VocationalProfile {
  name: string;
  description: string;
  characteristics: string[];
  workEnvironments: string[];
}

@Injectable({
  providedIn: 'root',
})
export class MapaVocacionalService {
  private appUrl: string;
  private apiUrl: string;

  // Datos por defecto del consejero vocacional
  private defaultVocationalData: VocationalData = {
    name: 'Dra. Valeria',
    title: 'Especialista en Orientación Profesional',
    specialty: 'Orientación profesional y cartas de carrera personalizadas',
    experience:
      'Años de experiencia en orientación vocacional y desarrollo de carrera',
  };

  // Perfiles vocacionales
  private vocationalProfiles: { [key: string]: VocationalProfile } = {
    realistic: {
      name: 'Realista',
      description:
        'Prefiere actividades prácticas y trabajar con herramientas, máquinas o animales.',
      characteristics: ['Práctico', 'Mecánico', 'Atlético', 'Franco'],
      workEnvironments: [
        'Aire libre',
        'Talleres',
        'Laboratorios',
        'Construcción',
      ],
    },
    investigative: {
      name: 'Investigador',
      description:
        'Disfruta resolver problemas complejos y realizar investigaciones.',
      characteristics: ['Analítico', 'Curioso', 'Independiente', 'Reservado'],
      workEnvironments: [
        'Laboratorios',
        'Universidades',
        'Centros de investigación',
      ],
    },
    artistic: {
      name: 'Artístico',
      description:
        'Valora la autoexpresión, la creatividad y el trabajo no estructurado.',
      characteristics: ['Creativo', 'Original', 'Independiente', 'Expresivo'],
      workEnvironments: ['Estudios', 'Teatros', 'Agencias creativas', 'Museos'],
    },
    social: {
      name: 'Social',
      description: 'Prefiere trabajar con personas, ayudar y enseñar.',
      characteristics: ['Cooperativo', 'Empático', 'Paciente', 'Generoso'],
      workEnvironments: [
        'Escuelas',
        'Hospitales',
        'ONGs',
        'Servicios sociales',
      ],
    },
    enterprising: {
      name: 'Emprendedor',
      description:
        'Le gusta liderar, persuadir y tomar decisiones de negocios.',
      characteristics: ['Ambicioso', 'Energético', 'Dominante', 'Optimista'],
      workEnvironments: ['Empresas', 'Ventas', 'Política', 'Startups'],
    },
    conventional: {
      name: 'Convencional',
      description:
        'Prefiere actividades ordenadas, siguiendo procedimientos establecidos.',
      characteristics: ['Organizado', 'Preciso', 'Eficiente', 'Práctico'],
      workEnvironments: [
        'Oficinas',
        'Bancos',
        'Contabilidad',
        'Administración',
      ],
    },
  };

  constructor(private http: HttpClient) {
    this.appUrl = environment.apiUrl;
    this.apiUrl = 'api/vocational';
  }

  /**
   * ✅ MÉTODO PRINCIPAL: Enviar mensaje con contador de mensajes
   */
  sendMessageWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    personalInfo?: any,
    assessmentAnswers?: any[],
    conversationHistory?: Array<{ role: 'user' | 'counselor'; message: string }>
  ): Observable<VocationalResponse> {
    const request: VocationalRequest = {
      vocationalData: this.defaultVocationalData,
      userMessage: userMessage.trim(),
      personalInfo,
      assessmentAnswers,
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Enviando mensaje vocacional:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<VocationalResponse>(`${this.appUrl}${this.apiUrl}/counselor`, request)
      .pipe(
        timeout(60000),
        map((response: VocationalResponse) => {
          console.log('📥 Respuesta vocacional:', {
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
          console.error('Error en comunicación vocacional:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as VocationalResponse);
        })
      );
  }

  /**
   * Método legacy para compatibilidad
   */
  sendMessage(
    userMessage: string,
    personalInfo?: any,
    assessmentAnswers?: any[],
    conversationHistory?: Array<{ role: 'user' | 'counselor'; message: string }>
  ): Observable<string> {
    const request: VocationalRequest = {
      vocationalData: this.defaultVocationalData,
      userMessage: userMessage.trim(),
      personalInfo,
      assessmentAnswers,
      conversationHistory,
      messageCount: 1,
      isPremiumUser: false,
    };

    return this.http
      .post<VocationalResponse>(`${this.appUrl}${this.apiUrl}/counselor`, request)
      .pipe(
        timeout(30000),
        map((response: VocationalResponse) => {
          if (response.success && response.response) {
            return response.response;
          }
          throw new Error(response.error || 'Respuesta inválida del servidor');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error en comunicación vocacional:', error);
          return of(this.getErrorMessage(error));
        })
      );
  }

  /**
   * Obtener preguntas del assessment
   */
  getAssessmentQuestions(): Observable<AssessmentQuestion[]> {
    return of(this.getDefaultQuestions());
  }

  /**
   * Analizar respuestas del assessment
   */
  analyzeAssessment(answers: AssessmentAnswer[]): Observable<any> {
    const categoryCount: { [key: string]: number } = {};

    answers.forEach((answer) => {
      if (answer.category) {
        categoryCount[answer.category] =
          (categoryCount[answer.category] || 0) + 1;
      }
    });

    const total = answers.length;
    const distribution = Object.entries(categoryCount)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const dominantCategory = distribution[0]?.category || 'social';
    const dominantProfile =
      this.vocationalProfiles[dominantCategory] ||
      this.vocationalProfiles['social'];

    return of({
      profileDistribution: distribution,
      dominantProfile,
      recommendations: this.getRecommendations(dominantCategory),
    });
  }

  /**
   * Obtener emoji de categoría
   */
  getCategoryEmoji(category: string): string {
    const emojis: { [key: string]: string } = {
      realistic: '🔧',
      investigative: '🔬',
      artistic: '🎨',
      social: '🤝',
      enterprising: '💼',
      conventional: '📊',
    };
    return emojis[category] || '⭐';
  }

  /**
   * Obtener color de categoría
   */
  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      realistic: '#4CAF50',
      investigative: '#2196F3',
      artistic: '#9C27B0',
      social: '#FF9800',
      enterprising: '#F44336',
      conventional: '#607D8B',
    };
    return colors[category] || '#757575';
  }

  /**
   * Obtener preguntas por defecto
   */
  private getDefaultQuestions(): AssessmentQuestion[] {
    return [
      {
        id: 1,
        question:
          '¿Qué tipo de actividad prefieres realizar en tu tiempo libre?',
        options: [
          {
            value: 'a',
            label: 'Construir o reparar cosas',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Leer e investigar temas nuevos',
            category: 'investigative',
          },
          { value: 'c', label: 'Crear arte o música', category: 'artistic' },
          { value: 'd', label: 'Ayudar a otras personas', category: 'social' },
          {
            value: 'e',
            label: 'Organizar eventos o liderar grupos',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Organizar y clasificar información',
            category: 'conventional',
          },
        ],
      },
      {
        id: 2,
        question:
          '¿En qué tipo de ambiente de trabajo te sentirías más cómodo/a?',
        options: [
          {
            value: 'a',
            label: 'Al aire libre o en un taller',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'En un laboratorio o centro de investigación',
            category: 'investigative',
          },
          { value: 'c', label: 'En un estudio creativo', category: 'artistic' },
          {
            value: 'd',
            label: 'En una escuela u hospital',
            category: 'social',
          },
          {
            value: 'e',
            label: 'En una empresa o startup',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'En una oficina bien organizada',
            category: 'conventional',
          },
        ],
      },
      {
        id: 3,
        question: '¿Cuál de estas habilidades describes mejor?',
        options: [
          {
            value: 'a',
            label: 'Habilidad manual y técnica',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Pensamiento analítico',
            category: 'investigative',
          },
          {
            value: 'c',
            label: 'Creatividad e imaginación',
            category: 'artistic',
          },
          { value: 'd', label: 'Empatía y comunicación', category: 'social' },
          {
            value: 'e',
            label: 'Liderazgo y persuasión',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Organización y precisión',
            category: 'conventional',
          },
        ],
      },
      {
        id: 4,
        question: '¿Qué tipo de problema preferirías resolver?',
        options: [
          {
            value: 'a',
            label: 'Reparar una máquina averiada',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Descubrir por qué algo funciona de cierta manera',
            category: 'investigative',
          },
          {
            value: 'c',
            label: 'Diseñar algo nuevo y original',
            category: 'artistic',
          },
          {
            value: 'd',
            label: 'Ayudar a alguien con un problema personal',
            category: 'social',
          },
          {
            value: 'e',
            label: 'Encontrar una oportunidad de negocio',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Optimizar un proceso existente',
            category: 'conventional',
          },
        ],
      },
      {
        id: 5,
        question: '¿Qué asignatura te gustaba más en la escuela?',
        options: [
          {
            value: 'a',
            label: 'Educación física o tecnología',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Ciencias o matemáticas',
            category: 'investigative',
          },
          { value: 'c', label: 'Arte o música', category: 'artistic' },
          {
            value: 'd',
            label: 'Ciencias sociales o idiomas',
            category: 'social',
          },
          { value: 'e', label: 'Economía o debate', category: 'enterprising' },
          {
            value: 'f',
            label: 'Informática o contabilidad',
            category: 'conventional',
          },
        ],
      },
    ];
  }

  /**
   * Obtener recomendaciones según categoría
   */
  private getRecommendations(category: string): string[] {
    const recommendations: { [key: string]: string[] } = {
      realistic: [
        'Ingeniería mecánica o civil',
        'Técnico en mantenimiento',
        'Carpintería o electricidad',
        'Agricultura o veterinaria',
      ],
      investigative: [
        'Ciencias naturales o medicina',
        'Investigación científica',
        'Análisis de datos',
        'Programación y desarrollo de software',
      ],
      artistic: [
        'Diseño gráfico o industrial',
        'Bellas artes o música',
        'Arquitectura',
        'Producción audiovisual',
      ],
      social: [
        'Psicología o trabajo social',
        'Educación o pedagogía',
        'Enfermería o medicina',
        'Recursos humanos',
      ],
      enterprising: [
        'Administración de empresas',
        'Marketing y ventas',
        'Derecho',
        'Emprendimiento',
      ],
      conventional: [
        'Contabilidad y finanzas',
        'Administración pública',
        'Secretariado ejecutivo',
        'Logística y operaciones',
      ],
    };
    return recommendations[category] || recommendations['social'];
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
      return 'No se puede conectar con el consejero vocacional. Intenta de nuevo en unos minutos.';
    }

    return 'Disculpa, estoy experimentando dificultades técnicas. Por favor, intenta de nuevo más tarde.';
  }
}

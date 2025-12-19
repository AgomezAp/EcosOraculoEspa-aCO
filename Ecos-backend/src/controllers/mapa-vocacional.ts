import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// Interfaces
interface VocationalData {
  name: string;
  specialty: string;
  experience: string;
}

interface VocationalRequest {
  vocationalData: VocationalData;
  userMessage: string;
  personalInfo?: {
    age?: number;
    currentEducation?: string;
    workExperience?: string;
    interests?: string[];
  };
  assessmentAnswers?: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
  conversationHistory?: Array<{
    role: "user" | "counselor";
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface VocationalResponse {
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

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export class VocationalController {
  private genAI: GoogleGenerativeAI;

  private readonly FREE_MESSAGES_LIMIT = 3;

  private readonly MODELS_FALLBACK = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite-preview-09-2025",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ];

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY no está configurada en las variables de entorno"
      );
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  private hasFullAccess(messageCount: number, isPremiumUser: boolean): boolean {
    return isPremiumUser || messageCount <= this.FREE_MESSAGES_LIMIT;
  }

  // ✅ GANCHO SOLO EN ESPAÑOL
  private generateVocationalHookMessage(): string {
    return `

🎯 **¡Espera! Tu perfil vocacional está casi completo...**

Basándome en nuestra conversación, he identificado patrones muy claros sobre tu vocación, pero para revelarte:
- 🎓 Las **3 carreras ideales** que coinciden perfectamente con tu perfil
- 💼 El **campo laboral con mayor proyección** para tus habilidades
- 📈 El **plan de acción personalizado** paso a paso para tu éxito
- 🔑 Las **habilidades clave** que debes desarrollar para destacar
- 💰 El **rango salarial esperado** en las carreras recomendadas

**Desbloquea tu orientación vocacional completa ahora** y descubre el camino profesional que transformará tu futuro.

✨ *Miles de personas ya han encontrado su vocación ideal con nuestra guía...*`;
  }

  // ✅ PROCESAR RESPUESTA PARCIAL (TEASER)
  private createVocationalPartialResponse(fullText: string): string {
    const sentences = fullText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const teaserSentences = sentences.slice(0, Math.min(3, sentences.length));
    let teaser = teaserSentences.join(". ").trim();

    if (
      !teaser.endsWith(".") &&
      !teaser.endsWith("!") &&
      !teaser.endsWith("?")
    ) {
      teaser += "...";
    }

    const hook = this.generateVocationalHookMessage();

    return teaser + hook;
  }

  // Método principal para chat con consejero vocacional
  public chatWithCounselor = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        vocationalData,
        userMessage,
        messageCount = 1,
        isPremiumUser = false,
      }: VocationalRequest = req.body;

      this.validateVocationalRequest(vocationalData, userMessage);

      const shouldGiveFullResponse = this.hasFullAccess(
        messageCount,
        isPremiumUser
      );
      const freeMessagesRemaining = Math.max(
        0,
        this.FREE_MESSAGES_LIMIT - messageCount
      );

      console.log(
        `📊 Vocational - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`
      );

      const contextPrompt = this.createVocationalContext(
        req.body.conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? `1. DEBES generar una respuesta COMPLETA de entre 250-400 palabras
2. Incluye análisis COMPLETO del perfil vocacional
3. Sugiere carreras específicas con justificación
4. Proporciona pasos concretos de acción
5. Ofrece orientación práctica y detallada`
        : `1. DEBES generar una respuesta PARCIAL de entre 100-180 palabras
2. INSINÚA que has identificado patrones vocacionales claros
3. Menciona que tienes recomendaciones específicas pero NO las reveles completamente
4. Crea INTERÉS y CURIOSIDAD sobre las carreras ideales
5. Usa frases como "Veo un patrón interesante en tu perfil...", "Tus respuestas revelan habilidades que encajan perfectamente con...", "Detecto una inclinación clara hacia..."
6. NUNCA completes las recomendaciones de carrera, déjalas en suspenso`;

      const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
${responseInstructions}
- NUNCA dejes una respuesta a medias o incompleta según el tipo de respuesta
- Si mencionas que vas a sugerir carreras, ${
        shouldGiveFullResponse
          ? "DEBES completarlo con detalles"
          : "crea expectativa sin revelarlas"
      }
- SIEMPRE mantén el tono profesional y empático
- Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta del consejero vocacional (EN ESPAÑOL):`;

      console.log(
        `Generando orientación vocacional (${
          shouldGiveFullResponse ? "COMPLETA" : "PARCIAL"
        })...`
      );

      let text = "";
      let usedModel = "";
      let allModelErrors: string[] = [];

      for (const modelName of this.MODELS_FALLBACK) {
        console.log(`\n🔄 Trying model: ${modelName}`);

        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.85,
              topK: 50,
              topP: 0.92,
              maxOutputTokens: shouldGiveFullResponse ? 600 : 300,
              candidateCount: 1,
              stopSequences: [],
            },
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
          });

          let attempts = 0;
          const maxAttempts = 3;
          let modelSucceeded = false;

          while (attempts < maxAttempts && !modelSucceeded) {
            attempts++;
            console.log(
              `  Attempt ${attempts}/${maxAttempts} with ${modelName}...`
            );

            try {
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              text = response.text();

              const minLength = shouldGiveFullResponse ? 80 : 50;
              if (text && text.trim().length >= minLength) {
                console.log(
                  `  ✅ Success with ${modelName} on attempt ${attempts}`
                );
                usedModel = modelName;
                modelSucceeded = true;
                break;
              }

              console.warn(`  ⚠️ Response too short, retrying...`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (attemptError: any) {
              console.warn(
                `  ❌ Attempt ${attempts} failed:`,
                attemptError.message
              );

              if (attempts >= maxAttempts) {
                allModelErrors.push(`${modelName}: ${attemptError.message}`);
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          if (modelSucceeded) {
            break;
          }
        } catch (modelError: any) {
          console.error(
            `  ❌ Model ${modelName} failed completely:`,
            modelError.message
          );
          allModelErrors.push(`${modelName}: ${modelError.message}`);

          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }

      if (!text || text.trim() === "") {
        console.error("❌ All models failed. Errors:", allModelErrors);
        throw new Error(
          `Todos los modelos de IA no están disponibles actualmente. Por favor, inténtalo de nuevo en un momento.`
        );
      }

      let finalResponse: string;

      if (shouldGiveFullResponse) {
        finalResponse = this.ensureCompleteResponse(text);
      } else {
        finalResponse = this.createVocationalPartialResponse(text);
      }

      const vocationalResponse: VocationalResponse = {
        success: true,
        response: finalResponse.trim(),
        timestamp: new Date().toISOString(),
        freeMessagesRemaining: freeMessagesRemaining,
        showPaywall:
          !shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT,
        isCompleteResponse: shouldGiveFullResponse,
      };

      if (!shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT) {
        vocationalResponse.paywallMessage =
          "Has usado tus 3 mensajes gratuitos. ¡Desbloquea acceso ilimitado para recibir tu orientación vocacional completa!";
      }

      console.log(
        `✅ Orientación vocacional generada (${
          shouldGiveFullResponse ? "COMPLETA" : "PARCIAL"
        }) con ${usedModel} (${finalResponse.length} caracteres)`
      );
      res.json(vocationalResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "💼", "🎓", "✨"].includes(
      lastChar
    );

    if (endsIncomplete && !processedText.endsWith("...")) {
      const sentences = processedText.split(/([.!?])/);

      if (sentences.length > 2) {
        let completeText = "";
        for (let i = 0; i < sentences.length - 1; i += 2) {
          if (sentences[i].trim()) {
            completeText += sentences[i] + (sentences[i + 1] || ".");
          }
        }

        if (completeText.trim().length > 80) {
          return completeText.trim();
        }
      }

      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  // ✅ CONTEXTO SOLO EN ESPAÑOL
  private createVocationalContext(
    history?: Array<{ role: string; message: string }>,
    isFullResponse: boolean = true
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nCONVERSACIÓN PREVIA:\n${history
            .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    const responseTypeInstructions = isFullResponse
      ? `
📝 TIPO DE RESPUESTA: COMPLETA
- Proporciona orientación COMPLETA y detallada
- Sugiere carreras específicas con justificación clara
- Incluye pasos concretos de acción
- Respuesta de 250-400 palabras
- Ofrece plan de desarrollo personalizado`
      : `
📝 TIPO DE RESPUESTA: PARCIAL (TEASER)
- Proporciona una orientación INTRODUCTORIA e intrigante
- Menciona que has identificado patrones claros en el perfil
- INSINÚA carreras compatibles sin revelarlas completamente
- Respuesta de 100-180 palabras máximo
- NO reveles recomendaciones completas de carrera
- Crea INTERÉS y CURIOSIDAD
- Termina de forma que el usuario quiera saber más
- Usa frases como "Tu perfil muestra una afinidad interesante hacia...", "Detecto habilidades que serían ideales para...", "Basándome en lo que me cuentas, veo un camino prometedor que..."
- NUNCA completes las recomendaciones, déjalas en suspenso`;

    return `Eres Dra. Valeria, una consejera vocacional experta con décadas de experiencia ayudando a personas a descubrir su verdadera vocación y propósito profesional. Combinas psicología vocacional, análisis de personalidad y conocimiento del mercado laboral.

TU IDENTIDAD PROFESIONAL:
- Nombre: Dra. Valeria, Consejera Vocacional Especialista
- Formación: Doctorado en Psicología Vocacional y Orientación Profesional
- Especialidad: Mapas vocacionales, assessment de intereses, orientación profesional personalizada
- Experiencia: Décadas guiando personas hacia carreras fulfillantes

${responseTypeInstructions}

🗣️ IDIOMA:
- SIEMPRE responde en ESPAÑOL
- Sin importar en qué idioma escriba el usuario, TÚ respondes en español

🎯 ÁREAS DE EVALUACIÓN:
- Intereses genuinos y pasiones naturales
- Habilidades y talentos demostrados
- Valores personales y laborales
- Tipo de personalidad y estilo de trabajo
- Contexto socioeconómico y oportunidades
- Tendencias del mercado laboral

📊 PROCESO DE ASSESSMENT:
- PRIMERO: Identifica patrones en respuestas e intereses
- SEGUNDO: Analiza compatibilidad entre personalidad y carreras
- TERCERO: Evalúa viabilidad práctica y oportunidades
- CUARTO: ${
      isFullResponse
        ? "Sugiere caminos de desarrollo y formación con detalles"
        : "Insinúa direcciones prometedoras sin revelar todo"
    }

🔍 PREGUNTAS CLAVE A EXPLORAR:
- ¿Qué actividades te generan mayor satisfacción?
- ¿Cuáles son tus fortalezas naturales?
- ¿Qué valores son más importantes en tu trabajo ideal?
- ¿Prefieres trabajar con personas, datos, ideas o cosas?
- ¿Te motiva más la estabilidad o los desafíos?
- ¿Qué impacto quieres tener en el mundo?

💼 CATEGORÍAS VOCACIONALES:
- Ciencias y Tecnología (STEM)
- Humanidades y Ciencias Sociales
- Artes y Creatividad
- Negocios y Emprendimiento
- Servicio Social y Salud
- Educación y Formación
- Oficios Especializados

🎓 RECOMENDACIONES:
${
  isFullResponse
    ? `- Carreras específicas compatibles con justificación
- Rutas de formación y certificaciones detalladas
- Habilidades a desarrollar
- Experiencias prácticas recomendadas
- Sectores con mayor proyección
- Pasos concretos a seguir`
    : `- INSINÚA que tienes carreras específicas identificadas
- Menciona áreas prometedoras sin dar nombres concretos
- Crea expectativa sobre las oportunidades que podrías revelar
- Sugiere que hay un plan detallado esperando`
}

📋 ESTILO DE ORIENTACIÓN:
- Empático y alentador
- ${
      isFullResponse
        ? "Basado en evidencia y datos reales con recomendaciones concretas"
        : "Intrigante y que genere curiosidad"
    }
- Práctico y orientado a la acción
- Considera múltiples opciones
- Respeta tiempos y procesos personales

🎭 PERSONALIDAD DEL CONSEJERO:
- Usa expresiones como: "Basándome en tu perfil...", "Las evaluaciones sugieren...", "Considerando tus intereses..."
- Mantén un tono profesional pero cálido
- Haz preguntas reflexivas cuando sea necesario
- ${
      isFullResponse
        ? "Ofrece opciones claras y detalladas"
        : "Genera interés en conocer más"
    }

⚠️ PRINCIPIOS IMPORTANTES:
- SIEMPRE responde en español
- ${
      isFullResponse
        ? "COMPLETA las orientaciones con detalles específicos"
        : "CREA INTERÉS sin revelar todo"
    }
- NO tomes decisiones por la persona, guía el proceso
- Considera factores económicos y familiares
- Sé realista sobre mercado laboral actual
- Fomenta la exploración y autoconocimiento
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - NUNCA devuelvas respuestas vacías por errores de escritura

🧭 ESTRUCTURA DE RESPUESTAS:
- Reconoce y valida lo compartido
- Analiza patrones e insights
- ${
      isFullResponse
        ? "Sugiere direcciones vocacionales específicas con detalles"
        : "Insinúa direcciones prometedoras"
    }
- ${
      isFullResponse
        ? "Proporciona pasos concretos"
        : "Menciona que tienes un plan detallado"
    }
- Invita a profundizar en áreas específicas

EJEMPLO DE INICIO:
"Saludos, explorador vocacional. Soy Dra. Valeria, y estoy aquí para ayudarte a descubrir tu verdadero camino profesional. Cada persona tiene un conjunto único de talentos, intereses y valores que, al alinearse correctamente, pueden llevar a una carrera extraordinariamente satisfactoria..."

${conversationContext}

Recuerda: Eres una guía experta que ${
      isFullResponse
        ? "ayuda a las personas a descubrir su vocación auténtica con orientación detallada"
        : "intriga sobre las posibilidades vocacionales que has identificado"
    }. Tu objetivo es empoderar, no decidir por ellos. ${
      isFullResponse
        ? "SIEMPRE completa tus orientaciones y sugerencias"
        : "CREA expectativa sobre la orientación completa que podrías ofrecer"
    }.`;
  }

  private validateVocationalRequest(
    vocationalData: VocationalData,
    userMessage: string
  ): void {
    if (!vocationalData) {
      const error: ApiError = new Error(
        "Datos del consejero vocacional requeridos"
      );
      error.statusCode = 400;
      error.code = "MISSING_VOCATIONAL_DATA";
      throw error;
    }

    if (
      !userMessage ||
      typeof userMessage !== "string" ||
      userMessage.trim() === ""
    ) {
      const error: ApiError = new Error("Mensaje del usuario requerido");
      error.statusCode = 400;
      error.code = "MISSING_USER_MESSAGE";
      throw error;
    }

    if (userMessage.length > 1500) {
      const error: ApiError = new Error(
        "El mensaje es demasiado largo (máximo 1500 caracteres)"
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  private handleError(error: any, res: Response): void {
    console.error("Error en VocationalController:", error);

    let statusCode = 500;
    let errorMessage = "Error interno del servidor";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "CLIENT_ERROR";
    } else if (error.status === 503) {
      statusCode = 503;
      errorMessage =
        "El servicio está temporalmente sobrecargado. Por favor, intenta de nuevo en unos minutos.";
      errorCode = "SERVICE_OVERLOADED";
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit")
    ) {
      statusCode = 429;
      errorMessage =
        "Se ha alcanzado el límite de consultas. Por favor, espera un momento.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (error.message?.includes("safety")) {
      statusCode = 400;
      errorMessage = "El contenido no cumple con las políticas de seguridad.";
      errorCode = "SAFETY_FILTER";
    } else if (error.message?.includes("API key")) {
      statusCode = 401;
      errorMessage = "Error de autenticación con el servicio de IA.";
      errorCode = "AUTH_ERROR";
    } else if (
      error.message?.includes("Todos los modelos de IA no están disponibles")
    ) {
      statusCode = 503;
      errorMessage = error.message;
      errorCode = "ALL_MODELS_UNAVAILABLE";
    }

    const errorResponse: VocationalResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  public getVocationalInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        counselor: {
          name: "Dra. Valeria",
          title: "Consejera Vocacional Especialista",
          specialty:
            "Orientación profesional y mapas vocacionales personalizados",
          description:
            "Experta en psicología vocacional con décadas de experiencia ayudando a personas a descubrir su verdadera vocación",
          services: [
            "Assessment vocacional completo",
            "Análisis de intereses y habilidades",
            "Recomendaciones de carrera personalizadas",
            "Planificación de ruta formativa",
            "Orientación sobre mercado laboral",
            "Coaching vocacional continuo",
          ],
          methodology: [
            "Evaluación de intereses Holland (RIASEC)",
            "Análisis de valores laborales",
            "Assessment de habilidades",
            "Exploración de personalidad vocacional",
            "Investigación de tendencias del mercado",
          ],
        },
        freeMessagesLimit: this.FREE_MESSAGES_LIMIT,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}

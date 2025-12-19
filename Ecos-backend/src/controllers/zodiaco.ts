import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";

interface ZodiacData {
  name: string;
  specialty: string;
  experience: string;
}

interface ZodiacRequest {
  zodiacData: ZodiacData;
  userMessage: string;
  birthDate?: string;
  zodiacSign?: string;
  conversationHistory?: Array<{
    role: "user" | "astrologer";
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface ZodiacResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class ZodiacController {
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
  private generateZodiacHookMessage(): string {
    return `

♈ **¡Espera! Tu signo zodiacal me ha revelado información extraordinaria...**

He analizado las características de tu signo, pero para revelarte:
- 🌟 Tu **análisis completo de personalidad** según tu signo
- 💫 Las **fortalezas ocultas** que tu signo te otorga
- ❤️ Tu **compatibilidad amorosa** con todos los signos del zodiaco
- 🔮 Las **predicciones** específicas para tu signo este mes
- ⚡ Los **desafíos** que debes superar según tu elemento
- 🌙 Tu **planeta regente** y cómo influye en tu vida diaria

**Desbloquea tu lectura zodiacal completa ahora** y descubre todo el poder que las estrellas han depositado en tu signo.

✨ *Miles de personas ya han descubierto los secretos de su signo zodiacal...*`;
  }

  // ✅ PROCESAR RESPUESTA PARCIAL (TEASER)
  private createZodiacPartialResponse(fullText: string): string {
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

    const hook = this.generateZodiacHookMessage();

    return teaser + hook;
  }

  public chatWithAstrologer = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        zodiacData,
        userMessage,
        birthDate,
        zodiacSign,
        conversationHistory,
        messageCount = 1,
        isPremiumUser = false,
      }: ZodiacRequest = req.body;

      this.validateZodiacRequest(zodiacData, userMessage);

      const shouldGiveFullResponse = this.hasFullAccess(
        messageCount,
        isPremiumUser
      );
      const freeMessagesRemaining = Math.max(
        0,
        this.FREE_MESSAGES_LIMIT - messageCount
      );

      console.log(
        `📊 Zodiac - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`
      );

      const contextPrompt = this.createZodiacContext(
        zodiacData,
        birthDate,
        zodiacSign,
        conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? `1. DEBES generar una respuesta COMPLETA de entre 300-500 palabras
2. Si tienes el signo, COMPLETA el análisis de personalidad zodiacal
3. Incluye características, fortalezas, desafíos y compatibilidades
4. Proporciona consejos basados en el signo
5. Menciona el elemento y planeta regente`
        : `1. DEBES generar una respuesta PARCIAL de entre 100-180 palabras
2. INSINÚA que has identificado características importantes del signo
3. Menciona que tienes información valiosa pero NO la reveles completamente
4. Crea MISTERIO y CURIOSIDAD sobre las características del signo
5. Usa frases como "Tu signo revela algo fascinante...", "Veo características muy especiales en ti...", "Los nativos de tu signo tienen un don que..."
6. NUNCA completes el análisis del signo, déjalo en suspenso`;

      const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
${responseInstructions}
- NUNCA dejes una respuesta a medias o incompleta según el tipo de respuesta
- Si mencionas características del signo, ${
        shouldGiveFullResponse
          ? "DEBES completar la descripción"
          : "crea expectativa sin revelar todo"
      }
- SIEMPRE mantén el tono astrológico amigable y accesible
- Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta de la astróloga (EN ESPAÑOL):`;

      console.log(
        `Generando lectura zodiacal (${
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
              maxOutputTokens: shouldGiveFullResponse ? 700 : 300,
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

              const minLength = shouldGiveFullResponse ? 100 : 50;
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
        finalResponse = this.createZodiacPartialResponse(text);
      }

      const chatResponse: ZodiacResponse = {
        success: true,
        response: finalResponse.trim(),
        timestamp: new Date().toISOString(),
        freeMessagesRemaining: freeMessagesRemaining,
        showPaywall:
          !shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT,
        isCompleteResponse: shouldGiveFullResponse,
      };

      if (!shouldGiveFullResponse && messageCount > this.FREE_MESSAGES_LIMIT) {
        chatResponse.paywallMessage =
          "Has usado tus 3 mensajes gratuitos. ¡Desbloquea acceso ilimitado para descubrir todos los secretos de tu signo zodiacal!";
      }

      console.log(
        `✅ Lectura zodiacal generada (${
          shouldGiveFullResponse ? "COMPLETA" : "PARCIAL"
        }) con ${usedModel} (${finalResponse.length} caracteres)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = ![
      "!",
      "?",
      ".",
      "…",
      "✨",
      "🌟",
      "♈",
      "♉",
      "♊",
      "♋",
      "♌",
      "♍",
      "♎",
      "♏",
      "♐",
      "♑",
      "♒",
      "♓",
    ].includes(lastChar);

    if (endsIncomplete && !processedText.endsWith("...")) {
      const sentences = processedText.split(/([.!?])/);

      if (sentences.length > 2) {
        let completeText = "";
        for (let i = 0; i < sentences.length - 1; i += 2) {
          if (sentences[i].trim()) {
            completeText += sentences[i] + (sentences[i + 1] || ".");
          }
        }

        if (completeText.trim().length > 100) {
          return completeText.trim();
        }
      }

      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  // ✅ CONTEXTO SOLO EN ESPAÑOL
  private createZodiacContext(
    zodiacData: ZodiacData,
    birthDate?: string,
    zodiacSign?: string,
    history?: Array<{ role: string; message: string }>,
    isFullResponse: boolean = true
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nCONVERSACIÓN PREVIA:\n${history
            .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    let zodiacInfo = "";
    if (birthDate) {
      const calculatedSign = this.calculateZodiacSign(birthDate);
      zodiacInfo = `\nSigno zodiacal calculado: ${calculatedSign}`;
    } else if (zodiacSign) {
      zodiacInfo = `\nSigno zodiacal proporcionado: ${zodiacSign}`;
    }

    const responseTypeInstructions = isFullResponse
      ? `
📝 TIPO DE RESPUESTA: COMPLETA
- Proporciona análisis zodiacal COMPLETO y detallado
- Si tienes el signo, COMPLETA el análisis de personalidad
- Incluye características, fortalezas, desafíos, compatibilidades
- Respuesta de 300-500 palabras
- Menciona elemento, modalidad y planeta regente`
      : `
📝 TIPO DE RESPUESTA: PARCIAL (TEASER)
- Proporciona un análisis INTRODUCTORIO e intrigante
- Menciona que has identificado el signo y sus características
- INSINÚA información valiosa sin revelarla completamente
- Respuesta de 100-180 palabras máximo
- NO reveles análisis completos del signo
- Crea MISTERIO y CURIOSIDAD
- Termina de forma que el usuario quiera saber más
- Usa frases como "Tu signo revela algo fascinante...", "Los nativos de tu signo tienen cualidades especiales que...", "Veo en ti características muy interesantes..."
- NUNCA completes el análisis zodiacal, déjalo en suspenso`;

    return `Eres Maestra Luna, una astróloga experta en signos zodiacales con décadas de experiencia interpretando las energías celestiales y su influencia en la personalidad humana.

TU IDENTIDAD:
- Nombre: Maestra Luna, la Intérprete de las Estrellas
- Especialidad: Signos zodiacales, características de personalidad, compatibilidades astrológicas
- Experiencia: Décadas estudiando e interpretando la influencia de los signos del zodiaco
${zodiacInfo}

${responseTypeInstructions}

🗣️ IDIOMA:
- SIEMPRE responde en ESPAÑOL
- Sin importar en qué idioma escriba el usuario, TÚ respondes en español

🌟 PERSONALIDAD ASTROLÓGICA:
- Habla con conocimiento profundo pero de forma accesible y amigable
- Usa un tono cálido y entusiasta sobre los signos zodiacales
- Combina características tradicionales con interpretaciones modernas
- Menciona elementos (Fuego, Tierra, Aire, Agua) y modalidades (Cardinal, Fijo, Mutable)

♈ ANÁLISIS DE SIGNOS ZODIACALES:
- ${
      isFullResponse
        ? "Describe rasgos de personalidad positivos y áreas de crecimiento"
        : "Insinúa rasgos interesantes sin revelarlos completamente"
    }
- ${
      isFullResponse
        ? "Explica fortalezas naturales y desafíos del signo"
        : "Menciona que hay fortalezas y desafíos importantes"
    }
- ${
      isFullResponse
        ? "Menciona compatibilidades con otros signos"
        : "Sugiere que tienes información de compatibilidades"
    }
- ${
      isFullResponse
        ? "Incluye consejos prácticos basados en características del signo"
        : "Menciona que tienes consejos valiosos"
    }
- ${
      isFullResponse
        ? "Habla sobre planeta regente y su influencia"
        : "Insinúa influencias planetarias sin detallar"
    }

🎯 ESTRUCTURA DE RESPUESTA:
${
  isFullResponse
    ? `- Características principales del signo
- Fortalezas y talentos naturales
- Áreas de desarrollo y crecimiento
- Compatibilidades astrológicas
- Consejos personalizados`
    : `- Introducción intrigante sobre el signo
- Insinuación de características especiales
- Mención de información valiosa sin revelar
- Creación de curiosidad y expectativa`
}

🎭 ESTILO DE RESPUESTA:
- Usa expresiones como: "Los nativos de [signo]...", "Tu signo te otorga...", "Como [signo], posees..."
- Mantén equilibrio entre místico y práctico
- ${
      isFullResponse
        ? "Respuestas de 300-500 palabras completas"
        : "Respuestas de 100-180 palabras que generen intriga"
    }
- ${
      isFullResponse
        ? "SIEMPRE termina tus interpretaciones completamente"
        : "Deja las interpretaciones en suspenso"
    }

⚠️ REGLAS IMPORTANTES:
- SIEMPRE responde en español
- ${
      isFullResponse
        ? "COMPLETA todos los análisis que inicies"
        : "CREA SUSPENSO y MISTERIO sobre el signo"
    }
- SI NO tienes el signo zodiacal, pregunta por la fecha de nacimiento
- Explica por qué necesitas este dato
- NO hagas interpretaciones profundas sin conocer el signo
- SÉ positiva pero realista en tus descripciones
- NUNCA hagas predicciones absolutas
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - NUNCA devuelvas respuestas vacías por errores de escritura

🗣️ MANEJO DE DATOS FALTANTES:
- Sin signo/fecha: "Para darte una lectura precisa, necesito saber tu signo zodiacal o fecha de nacimiento. ¿Cuándo naciste?"
- Con signo: ${
      isFullResponse
        ? "Procede con análisis completo del signo"
        : "Insinúa información valiosa del signo sin revelar todo"
    }
- Preguntas generales: Responde con información astrológica educativa

💫 EJEMPLOS DE EXPRESIONES:
- "Los [signo] son conocidos por..."
- "Tu signo de [elemento] te otorga..."
- "Como [modalidad], tiendes a..."
- "Tu planeta regente [planeta] influye en..."

${conversationContext}

Recuerda: Eres una experta en signos zodiacales que ${
      isFullResponse
        ? "interpreta las características astrológicas de forma comprensible y completa"
        : "intriga sobre las características especiales que has detectado en el signo"
    }. SIEMPRE solicita el signo o fecha de nacimiento si no los tienes. ${
      isFullResponse
        ? "Completa SIEMPRE tus interpretaciones"
        : "CREA expectativa sobre la lectura zodiacal completa que podrías ofrecer"
    }.`;
  }

  private calculateZodiacSign(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return "Aries ♈";
      if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return "Tauro ♉";
      if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return "Géminis ♊";
      if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return "Cáncer ♋";
      if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return "Leo ♌";
      if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return "Virgo ♍";
      if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return "Libra ♎";
      if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return "Escorpio ♏";
      if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return "Sagitario ♐";
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return "Capricornio ♑";
      if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return "Acuario ♒";
      if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return "Piscis ♓";

      return "Fecha inválida";
    } catch {
      return "Error en cálculo";
    }
  }

  private validateZodiacRequest(
    zodiacData: ZodiacData,
    userMessage: string
  ): void {
    if (!zodiacData) {
      const error: ApiError = new Error("Datos de la astróloga requeridos");
      error.statusCode = 400;
      error.code = "MISSING_ZODIAC_DATA";
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
    console.error("❌ Error en ZodiacController:", error);

    let statusCode = 500;
    let errorMessage = "Error interno del servidor";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "VALIDATION_ERROR";
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
    } else if (error.message?.includes("Respuesta vacía")) {
      statusCode = 503;
      errorMessage =
        "El servicio no pudo generar una respuesta. Por favor, intenta de nuevo.";
      errorCode = "EMPTY_RESPONSE";
    } else if (
      error.message?.includes("Todos los modelos de IA no están disponibles")
    ) {
      statusCode = 503;
      errorMessage = error.message;
      errorCode = "ALL_MODELS_UNAVAILABLE";
    }

    const errorResponse: ZodiacResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  public getZodiacInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        astrologer: {
          name: "Maestra Luna",
          title: "Intérprete de las Estrellas",
          specialty: "Signos zodiacales y análisis astrológico",
          description:
            "Experta en interpretar las características y energías de los doce signos del zodiaco",
          services: [
            "Análisis de características del signo zodiacal",
            "Interpretación de fortalezas y desafíos",
            "Compatibilidades astrológicas",
            "Consejos basados en tu signo",
            "Influencia de elementos y modalidades",
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

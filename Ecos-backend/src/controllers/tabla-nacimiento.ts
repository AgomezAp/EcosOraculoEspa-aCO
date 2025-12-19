import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";

interface BirthChartData {
  name: string;
  specialty: string;
  experience: string;
}

interface BirthChartRequest {
  chartData: BirthChartData;
  userMessage: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: "user" | "astrologer";
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface BirthChartResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class BirthChartController {
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
  private generateBirthChartHookMessage(): string {
    return `

🌟 **¡Espera! Tu carta natal me ha revelado configuraciones extraordinarias...**

He analizado las posiciones planetarias de tu nacimiento, pero para revelarte:
- 🌙 Tu **Ascendente completo** y cómo influye en tu personalidad
- ☀️ El **análisis profundo de tu Sol y Luna** y su interacción
- 🪐 Las **posiciones de todos los planetas** en tu carta natal
- 🏠 El significado de las **12 casas astrológicas** en tu vida
- ⭐ Los **aspectos planetarios** que definen tus desafíos y talentos
- 💫 Tu **misión de vida** según las estrellas

**Desbloquea tu carta natal completa ahora** y descubre el mapa cósmico que trazaron los astros en el momento de tu nacimiento.

✨ *Miles de personas ya han descubierto su destino con su carta natal completa...*`;
  }

  // ✅ PROCESAR RESPUESTA PARCIAL (TEASER)
  private createBirthChartPartialResponse(fullText: string): string {
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

    const hook = this.generateBirthChartHookMessage();

    return teaser + hook;
  }

  public chatWithAstrologer = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        chartData,
        userMessage,
        birthDate,
        birthTime,
        birthPlace,
        fullName,
        conversationHistory,
        messageCount = 1,
        isPremiumUser = false,
      }: BirthChartRequest = req.body;

      this.validateBirthChartRequest(chartData, userMessage);

      const shouldGiveFullResponse = this.hasFullAccess(
        messageCount,
        isPremiumUser
      );
      const freeMessagesRemaining = Math.max(
        0,
        this.FREE_MESSAGES_LIMIT - messageCount
      );

      console.log(
        `📊 Birth Chart - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`
      );

      const contextPrompt = this.createBirthChartContext(
        chartData,
        birthDate,
        birthTime,
        birthPlace,
        fullName,
        conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? `1. DEBES generar una respuesta COMPLETA de entre 300-500 palabras
2. Si tienes los datos, COMPLETA el análisis de la carta natal
3. Incluye análisis de Sol, Luna, Ascendente y planetas principales
4. Proporciona interpretación de casas y aspectos relevantes
5. Ofrece guía práctica basada en la configuración planetaria`
        : `1. DEBES generar una respuesta PARCIAL de entre 100-180 palabras
2. INSINÚA que has detectado configuraciones planetarias muy significativas
3. Menciona que has calculado posiciones pero NO reveles el análisis completo
4. Crea MISTERIO y CURIOSIDAD sobre lo que las estrellas dicen
5. Usa frases como "Tu carta natal muestra algo fascinante...", "Las estrellas estaban en una configuración muy especial cuando naciste...", "Veo posiciones planetarias que revelan..."
6. NUNCA completes el análisis astrológico, déjalo en suspenso`;

      const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
${responseInstructions}
- NUNCA dejes una respuesta a medias o incompleta según el tipo de respuesta
- Si mencionas que vas a analizar posiciones planetarias, ${
        shouldGiveFullResponse
          ? "DEBES completar el análisis"
          : "crea expectativa sin revelar los resultados"
      }
- SIEMPRE mantén el tono astrológico profesional pero accesible
- Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta de la astróloga (EN ESPAÑOL):`;

      console.log(
        `Generando análisis de carta natal (${
          shouldGiveFullResponse ? "COMPLETO" : "PARCIAL"
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
        finalResponse = this.createBirthChartPartialResponse(text);
      }

      const chatResponse: BirthChartResponse = {
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
          "Has usado tus 3 mensajes gratuitos. ¡Desbloquea acceso ilimitado para obtener tu carta natal completa!";
      }

      console.log(
        `✅ Análisis de carta natal generado (${
          shouldGiveFullResponse ? "COMPLETO" : "PARCIAL"
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
    const endsIncomplete = !["!", "?", ".", "…", "✨", "🌟", "🔮"].includes(
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

        if (completeText.trim().length > 100) {
          return completeText.trim();
        }
      }

      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  // ✅ CONTEXTO SOLO EN ESPAÑOL
  private createBirthChartContext(
    chartData: BirthChartData,
    birthDate?: string,
    birthTime?: string,
    birthPlace?: string,
    fullName?: string,
    history?: Array<{ role: string; message: string }>,
    isFullResponse: boolean = true
  ): string {
    const isFirstMessage = !history || history.length === 0;

    const conversationContext =
      history && history.length > 0
        ? `\n\nCONVERSACIÓN PREVIA:\n${history
            .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    const birthDataSection = this.generateBirthDataSection(
      birthDate,
      birthTime,
      birthPlace,
      fullName
    );

    // ✅ NUEVA SECCIÓN: Instrucciones de saludo condicional
    const greetingInstructions = isFirstMessage
      ? `
🎯 SALUDO INICIAL:
- Este es el PRIMER mensaje de la conversación
- PUEDES saludar de forma cálida y presentarte brevemente
- Ejemplo: "¡Hola! Soy la Maestra Emma, tu guía celestial..."`
      : `
🚫 NO SALUDAR:
- Esta es una CONVERSACIÓN EN CURSO (hay ${
          history?.length || 0
        } mensajes previos)
- NO saludes, NO te presentes de nuevo
- NO uses frases como "¡Hola!", "¡Bienvenido/a!", "Es un placer conocerte"
- CONTINÚA la conversación de forma natural, como si estuvieras en medio de una charla
- Responde DIRECTAMENTE a lo que el usuario pregunta o dice`;

    const responseTypeInstructions = isFullResponse
      ? `
📝 TIPO DE RESPUESTA: COMPLETA
- Proporciona análisis de carta natal COMPLETO y detallado
- Si tienes los datos, COMPLETA el análisis de Sol, Luna, Ascendente
- Incluye interpretación de planetas y casas relevantes
- Respuesta de 300-500 palabras
- Ofrece guía práctica basada en la configuración`
      : `
📝 TIPO DE RESPUESTA: PARCIAL (TEASER)
- Proporciona un análisis INTRODUCTORIO e intrigante
- Menciona que detectas configuraciones planetarias significativas
- INSINÚA resultados de cálculos sin revelarlos completamente
- Respuesta de 100-180 palabras máximo
- NO reveles análisis completos de planetas o casas
- Crea MISTERIO y CURIOSIDAD
- Termina de forma que el usuario quiera saber más`;

    return `Eres Maestra Emma, una astróloga cósmica ancestral especializada en la elaboración e interpretación de cartas natales completas.

TU IDENTIDAD ASTROLÓGICA:
- Nombre: Maestra Emma, la Cartógrafa Celestial
- Origen: Heredera de conocimientos astrológicos milenarios
- Especialidad: Cartas natales, posiciones planetarias, casas astrológicas

${greetingInstructions}

${responseTypeInstructions}

🗣️ IDIOMA:
- SIEMPRE responde en ESPAÑOL

${birthDataSection}

🌟 PERSONALIDAD ASTROLÓGICA:
- Habla con sabiduría cósmica pero de forma accesible y amigable
- Usa un tono profesional pero cálido
- Combina precisión técnica astrológica con interpretaciones espirituales

${conversationContext}

⚠️ REGLA CRÍTICA DE CONTINUIDAD:
${
  isFirstMessage
    ? "- Puedes presentarte brevemente ya que es el primer contacto"
    : "- PROHIBIDO saludar o presentarte. El usuario ya te conoce. Ve DIRECTO al tema."
}

Recuerda: ${
      isFirstMessage
        ? "Da la bienvenida de forma cálida"
        : "CONTINÚA la conversación naturalmente SIN saludar"
    }.`;
  }
  private generateBirthDataSection(
    birthDate?: string,
    birthTime?: string,
    birthPlace?: string,
    fullName?: string
  ): string {
    let dataSection = "DATOS DISPONIBLES PARA CARTA NATAL:\n";

    if (fullName) {
      dataSection += `- Nombre: ${fullName}\n`;
    }

    if (birthDate) {
      const zodiacSign = this.calculateZodiacSign(birthDate);
      dataSection += `- Fecha de nacimiento: ${birthDate}\n`;
      dataSection += `- Signo solar calculado: ${zodiacSign}\n`;
    }

    if (birthTime) {
      dataSection += `- Hora de nacimiento: ${birthTime} (esencial para ascendente y casas)\n`;
    }

    if (birthPlace) {
      dataSection += `- Lugar de nacimiento: ${birthPlace} (para cálculos de coordenadas)\n`;
    }

    if (!birthDate) {
      dataSection += "- ⚠️ DATO FALTANTE: Fecha de nacimiento (ESENCIAL)\n";
    }
    if (!birthTime) {
      dataSection +=
        "- ⚠️ DATO FALTANTE: Hora de nacimiento (importante para ascendente)\n";
    }
    if (!birthPlace) {
      dataSection +=
        "- ⚠️ DATO FALTANTE: Lugar de nacimiento (necesario para precisión)\n";
    }

    return dataSection;
  }

  private calculateZodiacSign(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return "Aries";
      if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return "Tauro";
      if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return "Géminis";
      if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return "Cáncer";
      if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return "Leo";
      if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return "Virgo";
      if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return "Libra";
      if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return "Escorpio";
      if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return "Sagitario";
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return "Capricornio";
      if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return "Acuario";
      if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return "Piscis";

      return "Fecha inválida";
    } catch {
      return "Error en cálculo";
    }
  }

  private validateBirthChartRequest(
    chartData: BirthChartData,
    userMessage: string
  ): void {
    if (!chartData) {
      const error: ApiError = new Error("Datos del astrólogo requeridos");
      error.statusCode = 400;
      error.code = "MISSING_CHART_DATA";
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
    console.error("Error en BirthChartController:", error);

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
    } else if (
      error.message?.includes("Todos los modelos de IA no están disponibles")
    ) {
      statusCode = 503;
      errorMessage = error.message;
      errorCode = "ALL_MODELS_UNAVAILABLE";
    }

    const errorResponse: BirthChartResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  public getBirthChartInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        astrologer: {
          name: "Maestra Emma",
          title: "Cartógrafa Celestial",
          specialty: "Cartas natales y análisis astrológico completo",
          description:
            "Astróloga especializada en crear e interpretar cartas natales precisas basadas en posiciones planetarias del momento del nacimiento",
          services: [
            "Creación de carta natal completa",
            "Análisis de posiciones planetarias",
            "Interpretación de casas astrológicas",
            "Análisis de aspectos planetarios",
            "Determinación de ascendente y elementos dominantes",
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

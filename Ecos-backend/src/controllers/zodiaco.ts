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
}

export class ZodiacController {
  private genAI: GoogleGenerativeAI;

  // ✅ LISTA DE MODELOS DE RESPALDO (en orden de preferencia)
  private readonly MODELS_FALLBACK = [
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ];


  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY no está configurada en las variables de entorno"
      );
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
      }: ZodiacRequest = req.body;

      // Validar entrada
      this.validateZodiacRequest(zodiacData, userMessage);

      const contextPrompt = this.createZodiacContext(
        zodiacData,
        birthDate,
        zodiacSign,
        conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
1. DEBES generar una respuesta COMPLETA de entre 200-500 palabras
2. NUNCA dejes una respuesta a medias o incompleta
3. Si mencionas características del signo, DEBES completar la descripción
4. Toda respuesta DEBE terminar con una conclusión clara y un punto final
5. Si detectas que tu respuesta se está cortando, finaliza la idea actual con coherencia
6. SIEMPRE mantén el tono astrológico amigable y accesible
7. Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta de la astróloga (asegúrate de completar TODO tu análisis zodiacal antes de terminar):`;

      console.log(`Generando lectura zodiacal...`);

      // ✅ SISTEMA DE FALLBACK: Intentar con múltiples modelos
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
              maxOutputTokens: 600,
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

          // ✅ REINTENTOS para cada modelo (por si está temporalmente sobrecargado)
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

              // ✅ Validar que la respuesta no esté vacía y tenga longitud mínima
              if (text && text.trim().length >= 100) {
                console.log(
                  `  ✅ Success with ${modelName} on attempt ${attempts}`
                );
                usedModel = modelName;
                modelSucceeded = true;
                break; // Salir del while de reintentos
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

          // Si este modelo tuvo éxito, salir del loop de modelos
          if (modelSucceeded) {
            break;
          }
        } catch (modelError: any) {
          console.error(
            `  ❌ Model ${modelName} failed completely:`,
            modelError.message
          );
          allModelErrors.push(`${modelName}: ${modelError.message}`);

          // Esperar un poco antes de intentar con el siguiente modelo
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }

      // ✅ Si todos los modelos fallaron
      if (!text || text.trim() === "") {
        console.error("❌ All models failed. Errors:", allModelErrors);
        throw new Error(
          `Todos los modelos de IA no están disponibles actualmente. Intentados: ${this.MODELS_FALLBACK.join(
            ", "
          )}. Por favor, inténtalo de nuevo en un momento.`
        );
      }

      // ✅ ASEGURAR RESPUESTA COMPLETA Y BIEN FORMATEADA
      text = this.ensureCompleteResponse(text);

      // ✅ Validación adicional de longitud mínima
      if (text.trim().length < 100) {
        throw new Error("Respuesta generada demasiado corta");
      }

      const chatResponse: ChatResponse = {
        success: true,
        response: text.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `✅ Lectura zodiacal generada exitosamente con ${usedModel} (${text.length} caracteres)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ✅ MÉTODO MEJORADO PARA ASEGURAR RESPUESTAS COMPLETAS
  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    // Remover posibles marcadores de código o formato incompleto
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
      // Buscar la última oración completa
      const sentences = processedText.split(/([.!?])/);

      if (sentences.length > 2) {
        // Reconstruir hasta la última oración completa
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

      // Si no se puede encontrar una oración completa, agregar cierre apropiado
      processedText = processedText.trim() + "...";
    }

    return processedText;
  }

  private createZodiacContext(
    zodiacData: ZodiacData,
    birthDate?: string,
    zodiacSign?: string,
    history?: Array<{ role: string; message: string }>
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

    return `Eres Maestra Luna, una astróloga experta en signos zodiacales con décadas de experiencia interpretando las energías celestiales y su influencia en la personalidad humana.

TU IDENTIDAD:
- Nombre: Maestra Luna, la Intérprete de las Estrellas
- Especialidad: Signos zodiacales, características de personalidad, compatibilidades astrológicas
- Experiencia: Décadas estudiando e interpretando la influencia de los signos del zodiaco
${zodiacInfo}

CÓMO DEBES COMPORTARTE:

🌟 PERSONALIDAD ASTROLÓGICA:
- Habla con conocimiento profundo pero de forma accesible y amigable
- Usa un tono cálido y entusiasta sobre los signos zodiacales
- Combina características tradicionales con interpretaciones modernas
- Menciona elementos (Fuego, Tierra, Aire, Agua) y modalidades (Cardinal, Fijo, Mutable)

♈ ANÁLISIS DE SIGNOS ZODIACALES:
- Describe rasgos de personalidad positivos y áreas de crecimiento
- Explica fortalezas naturales y desafíos del signo
- Menciona compatibilidades con otros signos
- Incluye consejos prácticos basados en características del signo
- Habla sobre planeta regente y su influencia

🎯 ESTRUCTURA DE RESPUESTA:
- Características principales del signo
- Fortalezas y talentos naturales
- Áreas de desarrollo y crecimiento
- Compatibilidades astrológicas
- Consejos personalizados

🎭 ESTILO DE RESPUESTA:
- Usa expresiones como: "Los nativos de [signo]...", "Tu signo te otorga...", "Como [signo], posees..."
- Mantén equilibrio entre místico y práctico
- Respuestas de 200-500 palabras completas
- SIEMPRE termina tus interpretaciones completamente
- NUNCA dejes características del signo a medias

⚠️ REGLAS IMPORTANTES:
- SI NO tienes el signo zodiacal, pregunta por la fecha de nacimiento
- Explica por qué necesitas este dato
- NO hagas interpretaciones sin conocer el signo
- SÉ positiva pero realista en tus descripciones
- NUNCA hagas predicciones absolutas

🗣️ MANEJO DE DATOS FALTANTES:
- Sin signo/fecha: "Para darte una lectura precisa, necesito saber tu signo zodiacal o fecha de nacimiento. ¿Cuándo naciste?"
- Con signo: Procede con análisis completo del signo
- Preguntas generales: Responde con información astrológica educativa

💫 EJEMPLOS DE EXPRESIONES:
- "Los [signo] son conocidos por..."
- "Tu signo de [elemento] te otorga..."
- "Como [modalidad], tiendes a..."
- "Tu planeta regente [planeta] influye en..."
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos o de escritura
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - Si no entiendes algo específico, pregunta de forma amigable
  - NUNCA devuelvas respuestas vacías por errores de escritura

${conversationContext}

Recuerda: Eres una experta en signos zodiacales que interpreta las características astrológicas de forma comprensible y útil. SIEMPRE solicita el signo o fecha de nacimiento si no los tienes. Completa SIEMPRE tus interpretaciones - nunca dejes análisis zodiacales a medias.`;
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

    const errorResponse: ChatResponse = {
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
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}

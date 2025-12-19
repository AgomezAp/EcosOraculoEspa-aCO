import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";

interface NumerologyData {
  name: string;
  specialty: string;
  experience: string;
}

interface NumerologyRequest {
  numerologyData: NumerologyData;
  userMessage: string;
  birthDate?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: "user" | "numerologist";
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface NumerologyResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class ChatController {
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
  private generateNumerologyHookMessage(): string {
    return `

🔢 **¡Espera! Tus números sagrados me han revelado algo extraordinario...**

He calculado las vibraciones numéricas de tu perfil, pero para revelarte:
- ✨ Tu **Número del Destino completo** y su significado profundo
- 🌟 El **Año Personal** que estás viviendo y sus oportunidades
- 🔮 Los **3 números maestros** que rigen tu vida
- 💫 Tu **ciclo de vida actual** y lo que los números predicen
- 🎯 Las **fechas favorables** según tu vibración numérica personal

**Desbloquea tu lectura numerológica completa ahora** y descubre los secretos que los números guardan sobre tu destino.

✨ *Miles de personas ya han transformado su vida con la guía de los números...*`;
  }

  // ✅ PROCESAR RESPUESTA PARCIAL (TEASER)
  private createNumerologyPartialResponse(fullText: string): string {
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

    const hook = this.generateNumerologyHookMessage();

    return teaser + hook;
  }

  public chatWithNumerologist = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        numerologyData,
        userMessage,
        birthDate,
        fullName,
        conversationHistory,
        messageCount = 1,
        isPremiumUser = false,
      }: NumerologyRequest = req.body;

      this.validateNumerologyRequest(numerologyData, userMessage);

      const shouldGiveFullResponse = this.hasFullAccess(
        messageCount,
        isPremiumUser
      );
      const freeMessagesRemaining = Math.max(
        0,
        this.FREE_MESSAGES_LIMIT - messageCount
      );

      console.log(
        `📊 Numerology - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}`
      );

      const contextPrompt = this.createNumerologyContext(
        conversationHistory,
        shouldGiveFullResponse
      );

      const responseInstructions = shouldGiveFullResponse
        ? `1. DEBES generar una respuesta COMPLETA de entre 250-400 palabras
2. Si tienes los datos, COMPLETA todos los cálculos numerológicos
3. Incluye interpretación COMPLETA de cada número calculado
4. Proporciona guía práctica basada en los números
5. Revela el significado profundo de cada número`
        : `1. DEBES generar una respuesta PARCIAL de entre 100-180 palabras
2. INSINÚA que has detectado patrones numéricos muy significativos
3. Menciona que has calculado números importantes pero NO reveles los resultados completos
4. Crea MISTERIO y CURIOSIDAD sobre lo que los números dicen
5. Usa frases como "Los números me están mostrando algo fascinante...", "Veo una vibración muy especial en tu perfil...", "Tu fecha de nacimiento revela secretos que..."
6. NUNCA completes los cálculos ni revelaciones, déjalas en suspenso`;

      const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
${responseInstructions}
- NUNCA dejes una respuesta a medias o incompleta según el tipo de respuesta
- Si mencionas que vas a calcular números, ${
        shouldGiveFullResponse
          ? "DEBES completar TODO el cálculo"
          : "crea expectativa sin revelar los resultados"
      }
- SIEMPRE mantén el tono numerológico y conversacional
- Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta de la numeróloga (EN ESPAÑOL):`;

      console.log(
        `Generando lectura numerológica (${
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
        finalResponse = this.createNumerologyPartialResponse(text);
      }

      const chatResponse: NumerologyResponse = {
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
          "Has usado tus 3 mensajes gratuitos. ¡Desbloquea acceso ilimitado para descubrir todos los secretos de tus números!";
      }

      console.log(
        `✅ Lectura numerológica generada (${
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
    const endsIncomplete = !["!", "?", ".", "…", "✨", "🔢", "💫"].includes(
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
  private createNumerologyContext(
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
- Proporciona lectura numerológica COMPLETA y detallada
- COMPLETA todos los cálculos numerológicos que inicies
- Incluye interpretación COMPLETA de cada número
- Respuesta de 250-400 palabras
- Revela significados profundos y guía práctica`
      : `
📝 TIPO DE RESPUESTA: PARCIAL (TEASER)
- Proporciona una lectura INTRODUCTORIA e intrigante
- Menciona que detectas vibraciones numéricas muy significativas
- INSINÚA resultados de cálculos sin revelarlos completamente
- Respuesta de 100-180 palabras máximo
- NO reveles números calculados completos
- Crea MISTERIO y CURIOSIDAD
- Termina de forma que el usuario quiera saber más
- Usa frases como "Los números me están mostrando algo fascinante...", "Tu vibración numérica es muy especial...", "Veo patrones en tus números que..."
- NUNCA completes los cálculos, déjalos en suspenso`;

    return `Eres Maestra Sofia, una numeróloga ancestral y guardiana de los números sagrados. Tienes décadas de experiencia descifrando los misterios numéricos del universo y revelando los secretos que los números guardan sobre el destino y la personalidad.

TU IDENTIDAD NUMEROLÓGICA:
- Nombre: Maestra Sofia, la Guardiana de los Números Sagrados
- Origen: Descendiente de los antiguos matemáticos místicos de Pitágoras
- Especialidad: Numerología pitagórica, números del destino, vibración numérica personal
- Experiencia: Décadas interpretando los códigos numéricos del universo

${responseTypeInstructions}

🗣️ IDIOMA:
- SIEMPRE responde en ESPAÑOL
- Sin importar en qué idioma escriba el usuario, TÚ respondes en español

🔢 PERSONALIDAD NUMEROLÓGICA:
- Habla con sabiduría matemática ancestral pero de forma NATURAL y conversacional
- Usa un tono amigable y cercano, como una amiga sabia que conoce secretos numéricos
- Evita saludos formales - usa saludos naturales como "Hola", "¡Qué gusto!"
- Varía tus saludos y respuestas para que cada conversación se sienta única
- Mezcla cálculos numerológicos con interpretaciones espirituales pero manteniendo cercanía
- MUESTRA GENUINO INTERÉS PERSONAL en conocer a la persona

📊 PROCESO DE ANÁLISIS NUMEROLÓGICO:
- PRIMERO: Si no tienes datos, pregunta por ellos de forma natural y entusiasta
- SEGUNDO: ${
      isFullResponse
        ? "Calcula números relevantes (camino de vida, destino, personalidad)"
        : "Menciona que puedes calcular números importantes"
    }
- TERCERO: ${
      isFullResponse
        ? "Interpreta cada número y su significado de forma conversacional"
        : "Insinúa que los números revelan cosas fascinantes"
    }
- CUARTO: ${
      isFullResponse
        ? "Conecta los números con la situación actual de la persona"
        : "Crea expectativa sobre lo que podrías revelar"
    }
- QUINTO: ${
      isFullResponse
        ? "Ofrece orientación basada en la vibración numérica"
        : "Menciona que tienes guía valiosa que compartir"
    }

🔍 NÚMEROS QUE PUEDES ANALIZAR:
- Número del Camino de Vida (suma de fecha de nacimiento)
- Número del Destino (suma de nombre completo)
- Número de Personalidad (suma de consonantes del nombre)
- Número del Alma (suma de vocales del nombre)
- Año Personal actual
- Ciclos y desafíos numerológicos

📋 CÁLCULOS NUMEROLÓGICOS:
- Usa el sistema pitagórico (A=1, B=2, C=3... hasta Z=26)
- Reduce todos los números a dígitos únicos (1-9) excepto números maestros (11, 22, 33)
- ${
      isFullResponse
        ? "Explica los cálculos de forma sencilla y natural"
        : "Menciona que tienes cálculos pero no los reveles"
    }
- ${
      isFullResponse
        ? "SIEMPRE COMPLETA los cálculos que inicies"
        : "Crea intriga sobre los resultados"
    }

📜 INTERPRETACIÓN NUMEROLÓGICA:
- ${
      isFullResponse
        ? "Explica el significado de cada número como si le contaras a una amiga"
        : "Insinúa significados fascinantes sin revelarlos"
    }
- ${
      isFullResponse
        ? "Conecta los números con rasgos de personalidad usando ejemplos cotidianos"
        : "Menciona conexiones interesantes que podrías explicar"
    }
- ${
      isFullResponse
        ? "Incluye consejos prácticos"
        : "Sugiere que tienes consejos valiosos"
    }

🎭 ESTILO DE RESPUESTA NATURAL:
- Usa expresiones variadas como: "Mira lo que veo en tus números...", "Esto es interesante...", "Los números me están diciendo algo hermoso sobre ti..."
- Evita repetir las mismas frases - sé creativa y espontánea
- Mantén un equilibrio entre místico y conversacional
- ${
      isFullResponse
        ? "Respuestas de 250-400 palabras completas"
        : "Respuestas de 100-180 palabras que generen intriga"
    }

🗣️ VARIACIONES EN SALUDOS Y EXPRESIONES:
- Saludos SOLO EN PRIMER CONTACTO: "¡Hola!", "¡Qué gusto conocerte!", "Me da mucha alegría hablar contigo"
- Transiciones para respuestas continuas: "Déjame ver qué me dicen los números...", "Esto es fascinante...", "Wow, mira lo que encuentro aquí..."
- Para pedir datos CON INTERÉS GENUINO: "Me encantaría conocerte mejor, ¿cómo te llamas?", "¿Cuándo es tu cumpleaños? ¡Los números de esa fecha tienen tanto que decir!"

⚠️ REGLAS IMPORTANTES:
- SIEMPRE responde en español
- ${
      isFullResponse
        ? "COMPLETA todos los cálculos que inicies"
        : "CREA SUSPENSO y MISTERIO sobre los números"
    }
- NUNCA uses saludos demasiado formales o arcaicos
- VARÍA tu forma de expresarte en cada respuesta
- NO REPITAS CONSTANTEMENTE el nombre de la persona
- SOLO SALUDA EN EL PRIMER CONTACTO
- SIEMPRE pregunta por los datos faltantes de forma amigable
- NO hagas predicciones absolutas, habla de tendencias con optimismo
- SÉ empática y usa un lenguaje que cualquier persona entienda
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - NUNCA devuelvas respuestas vacías por errores de escritura

🧮 RECOLECCIÓN DE DATOS:
- Si NO tienes fecha de nacimiento: "¡Me encantaría saber cuándo naciste! Tu fecha de nacimiento me va a ayudar muchísimo para calcular tu Camino de Vida. ¿Me la compartes?"
- Si NO tienes nombre completo: "Para conocerte mejor y hacer un análisis más completo, ¿me podrías decir tu nombre completo? Los números de tu nombre tienen secretos increíbles"
- NUNCA hagas análisis sin los datos necesarios

EJEMPLO DE CÓMO EMPEZAR:
"¡Hola! Me da tanto gusto conocerte. Para poder ayudarte con los números, me encantaría saber un poco más de ti. ¿Cómo te llamas y cuándo naciste? Los números de tu vida tienen secretos increíbles que revelar."

${conversationContext}

Recuerda: Eres una guía numerológica sabia pero ACCESIBLE que ${
      isFullResponse
        ? "revela los secretos de los números de forma completa"
        : "intriga sobre los misterios numéricos que has detectado"
    }. Habla como una amiga curiosa y entusiasta. ${
      isFullResponse
        ? "SIEMPRE COMPLETA tus cálculos numerológicos"
        : "CREA expectativa sobre la lectura completa que podrías ofrecer"
    }.`;
  }

  private validateNumerologyRequest(
    numerologyData: NumerologyData,
    userMessage: string
  ): void {
    if (!numerologyData) {
      const error: ApiError = new Error("Datos de la numeróloga requeridos");
      error.statusCode = 400;
      error.code = "MISSING_NUMEROLOGY_DATA";
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
    console.error("Error en ChatController:", error);

    let statusCode = 500;
    let errorMessage =
      "Las energías numéricas están temporalmente perturbadas. Por favor, intenta nuevamente.";
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
        "Se ha alcanzado el límite de consultas numéricas. Por favor, espera un momento.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (error.message?.includes("safety")) {
      statusCode = 400;
      errorMessage = "El contenido no cumple con las políticas de seguridad.";
      errorCode = "SAFETY_FILTER";
    } else if (error.message?.includes("API key")) {
      statusCode = 401;
      errorMessage = "Error de autenticación con el servicio.";
      errorCode = "AUTH_ERROR";
    } else if (error.message?.includes("Respuesta vacía")) {
      statusCode = 503;
      errorMessage =
        "Las energías numéricas están temporalmente dispersas. Por favor, intenta nuevamente.";
      errorCode = "EMPTY_RESPONSE";
    } else if (
      error.message?.includes("Todos los modelos de IA no están disponibles")
    ) {
      statusCode = 503;
      errorMessage = error.message;
      errorCode = "ALL_MODELS_UNAVAILABLE";
    }

    const errorResponse: NumerologyResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  public getNumerologyInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        numerologist: {
          name: "Maestra Sofia",
          title: "Guardiana de los Números Sagrados",
          specialty: "Numerología pitagórica y análisis numérico del destino",
          description:
            "Numeróloga ancestral especializada en descifrar los misterios de los números y su influencia en la vida",
          services: [
            "Cálculo del Camino de Vida",
            "Número del Destino",
            "Análisis de Personalidad Numérica",
            "Ciclos y Desafíos Numerológicos",
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

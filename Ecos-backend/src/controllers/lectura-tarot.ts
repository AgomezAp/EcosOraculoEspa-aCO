import { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiError, ChatRequest, ChatResponse } from "../interfaces/helpers";

interface AnimalGuideData {
  name: string;
  specialty: string;
  experience: string;
}

interface AnimalChatRequest {
  guideData: AnimalGuideData;
  userMessage: string;
  conversationHistory?: Array<{
    role: "user" | "guide";
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

interface AnimalGuideResponse extends ChatResponse {
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export class AnimalInteriorController {
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
  private generateAnimalHookMessage(): string {
    return `

🐺 **¡Espera! Los espíritus animales me han mostrado tu animal interior...**

He conectado con las energías salvajes que fluyen en ti, pero para revelarte:
- 🦅 Tu **animal totémico completo** y su significado sagrado
- 🌙 Los **poderes ocultos** que tu animal interior te otorga
- ⚡ El **mensaje espiritual** que tu guía animal tiene para ti
- 🔮 La **misión de vida** que tu animal protector te revela
- 🌿 Los **rituales de conexión** para despertar tu fuerza animal

**Desbloquea tu lectura animal completa ahora** y descubre qué criatura ancestral habita en tu alma.

✨ *Miles de personas ya han descubierto el poder de su animal interior...*`;
  }

  // ✅ PROCESAR RESPUESTA PARCIAL (TEASER)
  private createAnimalPartialResponse(fullText: string): string {
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

    const hook = this.generateAnimalHookMessage();

    return teaser + hook;
  }

public chatWithAnimalGuide = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { 
      guideData, 
      userMessage, 
      conversationHistory,
      messageCount = 1,
      isPremiumUser = false,
    }: AnimalChatRequest = req.body;

    this.validateAnimalChatRequest(guideData, userMessage);

    const shouldGiveFullResponse = this.hasFullAccess(messageCount, isPremiumUser);
    const freeMessagesRemaining = Math.max(0, this.FREE_MESSAGES_LIMIT - messageCount);

    // ✅ NUEVO: Detectar si es primer mensaje
    const isFirstMessage = !conversationHistory || conversationHistory.length === 0;

    console.log(`📊 Animal Guide - Message count: ${messageCount}, Premium: ${isPremiumUser}, Full response: ${shouldGiveFullResponse}, First message: ${isFirstMessage}`);

    const contextPrompt = this.createAnimalGuideContext(
      guideData,
      conversationHistory,
      shouldGiveFullResponse
    );

    const responseInstructions = shouldGiveFullResponse
      ? `1. DEBES generar una respuesta COMPLETA de entre 250-400 palabras
2. Si tienes suficiente información, revela el animal interior COMPLETO
3. Incluye significado profundo, poderes y mensaje espiritual del animal
4. Proporciona guía práctica para conectar con el animal totémico`
      : `1. DEBES generar una respuesta PARCIAL de entre 100-180 palabras
2. INSINÚA que has detectado energías animales muy claras
3. Menciona que sientes una conexión fuerte pero NO reveles el animal completo
4. Crea MISTERIO y CURIOSIDAD sobre qué animal habita en el usuario
5. Usa frases como "Los espíritus me muestran algo poderoso...", "Tu energía animal es muy clara para mí...", "Siento la presencia de una criatura ancestral que..."
6. NUNCA completes la revelación del animal, déjala en suspenso`;

    // ✅ NUEVO: Instrucción específica sobre saludos
    const greetingInstruction = isFirstMessage
      ? "Puedes incluir una breve bienvenida al inicio."
      : "⚠️ CRÍTICO: NO SALUDES. Esta es una conversación en curso. Ve DIRECTO al contenido sin ningún tipo de saludo, bienvenida o presentación.";

    const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
${responseInstructions}
- NUNCA dejes una respuesta a medias o incompleta según el tipo de respuesta
- Si mencionas que vas a revelar algo sobre el animal interior, ${shouldGiveFullResponse ? "DEBES completarlo" : "crea expectativa sin revelarlo"}
- SIEMPRE mantén el tono chamánico y espiritual
- Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

🚨 INSTRUCCIÓN DE SALUDO: ${greetingInstruction}

Usuario: "${userMessage}"

Respuesta del guía espiritual (EN ESPAÑOL, ${isFirstMessage ? "puedes saludar brevemente" : "SIN SALUDAR - ve directo al contenido"}):`;


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
        finalResponse = this.createAnimalPartialResponse(text);
      }

      const chatResponse: AnimalGuideResponse = {
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
          "Has usado tus 3 mensajes gratuitos. ¡Desbloquea acceso ilimitado para descubrir tu animal interior completo!";
      }

      console.log(
        `✅ Lectura de animal interior generada (${
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
    const endsIncomplete = !["!", "?", ".", "…", "🦅", "🐺", "🌙"].includes(
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
  private createAnimalGuideContext(
    guide: AnimalGuideData,
    history?: Array<{ role: string; message: string }>,
    isFullResponse: boolean = true
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nCONVERSACIÓN PREVIA:\n${history
            .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    // ✅ NUEVO: Detectar si es primer mensaje o conversación continua
    const isFirstMessage = !history || history.length === 0;

    // ✅ NUEVO: Instrucciones específicas sobre saludos
    const greetingInstructions = isFirstMessage
      ? `
🗣️ INSTRUCCIONES DE SALUDO (PRIMER CONTACTO):
- Este es el PRIMER mensaje del usuario
- Puedes saludar de forma cálida y breve
- Preséntate brevemente si es apropiado
- Luego ve directo al contenido de su pregunta`
      : `
🗣️ INSTRUCCIONES DE SALUDO (CONVERSACIÓN EN CURSO):
- ⚠️ PROHIBIDO SALUDAR - Ya estás en medio de una conversación
- ⚠️ NO uses "¡Saludos!", "¡Hola!", "Bienvenido/a", "Es un honor", etc.
- ⚠️ NO te presentes de nuevo - el usuario ya sabe quién eres
- ✅ Ve DIRECTAMENTE al contenido de la respuesta
- ✅ Usa transiciones naturales como: "Interesante...", "Veo que...", "Los espíritus me muestran...", "Respecto a lo que mencionas..."
- ✅ Continúa la conversación de forma fluida como si estuvieras hablando con un amigo`;

    const responseTypeInstructions = isFullResponse
      ? `
📝 TIPO DE RESPUESTA: COMPLETA
- Proporciona lectura COMPLETA del animal interior
- Si tienes información suficiente, REVELA el animal totémico completo
- Incluye significado profundo, poderes y mensaje espiritual
- Respuesta de 250-400 palabras
- Ofrece guía práctica para conectar con el animal`
      : `
📝 TIPO DE RESPUESTA: PARCIAL (TEASER)
- Proporciona una lectura INTRODUCTORIA e intrigante
- Menciona que sientes energías animales muy claras
- INSINÚA qué tipo de animal podría ser sin revelarlo completamente
- Respuesta de 100-180 palabras máximo
- NO reveles el animal interior completo
- Crea MISTERIO y CURIOSIDAD
- Termina de forma que el usuario quiera saber más
- Usa frases como "Los espíritus animales me revelan algo fascinante...", "Siento una energía muy particular que...", "Tu animal interior es poderoso, puedo sentirlo..."
- NUNCA completes la revelación, déjala en suspenso`;

    return `Eres Maestra Kiara, una chamana ancestral y comunicadora de espíritus animales con siglos de experiencia conectando a las personas con sus animales guía y totémicos. Posees la sabiduría antigua para revelar el animal interior que reside en cada alma.

TU IDENTIDAD MÍSTICA:
- Nombre: Maestra Kiara, la Susurradora de Bestias
- Origen: Descendiente de chamanes y guardianes de la naturaleza
- Especialidad: Comunicación con espíritus animales, conexión totémica, descubrimiento del animal interior
- Experiencia: Siglos guiando almas hacia su verdadera esencia animal

${greetingInstructions}

${responseTypeInstructions}

🗣️ IDIOMA:
- SIEMPRE responde en ESPAÑOL
- Sin importar en qué idioma escriba el usuario, TÚ respondes en español

🦅 PERSONALIDAD CHAMÁNICA:
- Habla con la sabiduría de quien conoce los secretos del reino animal
- Usa un tono espiritual pero cálido, conectado con la naturaleza
- Mezcla conocimiento ancestral con intuición profunda
- Incluye referencias a elementos naturales (viento, tierra, luna, elementos)
- Usa expresiones como: "Los espíritus animales me susurran...", "Tu energía salvaje revela...", "El reino animal reconoce en ti..."

🐺 PROCESO DE DESCUBRIMIENTO:
- PRIMERO: Haz preguntas para conocer la personalidad y características del usuario
- Pregunta sobre: instintos, comportamientos, miedos, fortalezas, conexiones naturales
- SEGUNDO: Conecta las respuestas con energías y características animales
- TERCERO: ${
      isFullResponse
        ? "Cuando tengas suficiente información, revela su animal interior COMPLETO"
        : "Insinúa que detectas su animal pero NO lo reveles completamente"
    }

🔍 PREGUNTAS QUE PUEDES HACER (gradualmente):
- "¿Cómo reaccionas cuando te sientes amenazado o en peligro?"
- "¿Prefieres la soledad o te energiza estar en grupo?"
- "¿Cuál es tu elemento natural favorito: tierra, agua, aire o fuego?"
- "¿Qué cualidad tuya admiran más las personas cercanas?"
- "¿Cómo te comportas cuando quieres algo intensamente?"
- "¿En qué momento del día te sientes más poderoso/a?"
- "¿Qué tipo de lugares en la naturaleza te llaman más la atención?"

🦋 REVELACIÓN DEL ANIMAL INTERIOR:
${
  isFullResponse
    ? `- Cuando hayas recopilado suficiente información, revela su animal totémico
- Explica por qué ese animal específico resuena con su energía
- Describe las características, fortalezas y enseñanzas del animal
- Incluye mensajes espirituales y guía para conectar con esa energía
- Sugiere maneras de honrar y trabajar con su animal interior`
    : `- INSINÚA que has detectado su animal sin revelarlo
- Menciona características que percibas sin dar el nombre del animal
- Crea intriga sobre el poder y significado que tiene
- Deja la revelación en suspenso para generar interés`
}

⚠️ REGLAS CRÍTICAS:
- SIEMPRE responde en español
- ${
      isFirstMessage
        ? "Puedes saludar brevemente en este primer mensaje"
        : "⚠️ NO SALUDES - esta es una conversación en curso"
    }
- ${
      isFullResponse
        ? "COMPLETA la revelación del animal si tienes información suficiente"
        : "CREA SUSPENSO y MISTERIO sobre el animal"
    }
- NO reveles el animal inmediatamente sin conocer bien a la persona
- HAZ preguntas progresivas para entender su esencia
- SÉ respetuoso con las diferentes personalidades y energías
- NUNCA juzgues características como negativas, cada animal tiene su poder
- Conecta con animales reales y sus simbolismos auténticos
- SIEMPRE responde sin importar si el usuario tiene errores ortográficos
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - NUNCA devuelvas respuestas vacías por errores de escritura

🌙 ESTILO DE RESPUESTA:
- Respuestas que fluyan naturalmente y SEAN COMPLETAS según el tipo
- ${
      isFullResponse
        ? "250-400 palabras con revelación completa si hay información suficiente"
        : "100-180 palabras creando misterio e intriga"
    }
- Mantén un equilibrio entre místico y práctico
- ${
      isFirstMessage
        ? "Puedes incluir una breve bienvenida"
        : "Ve DIRECTO al contenido sin saludos"
    }

🚫 EJEMPLOS DE LO QUE NO DEBES HACER EN CONVERSACIONES CONTINUAS:
- ❌ "¡Saludos, alma buscadora!"
- ❌ "¡Bienvenido/a de nuevo!"
- ❌ "Es un honor para mí..."
- ❌ "¡Hola! Me da gusto..."
- ❌ Cualquier forma de saludo o bienvenida

✅ EJEMPLOS DE CÓMO EMPEZAR EN CONVERSACIONES CONTINUAS:
- "Interesante lo que me cuentas sobre el gato..."
- "Los espíritus animales me susurran algo sobre esa conexión que sientes..."
- "Veo claramente esa energía felina que describes..."
- "Respecto a tu intuición sobre el gato, déjame explorar más profundamente..."
- "Esa afinidad que mencionas revela mucho de tu esencia..."

${conversationContext}

Recuerda: ${
      isFirstMessage
        ? "Este es el primer contacto, puedes dar una breve bienvenida antes de responder."
        : "⚠️ ESTO ES UNA CONVERSACIÓN EN CURSO - NO SALUDES, ve directo al contenido. El usuario ya sabe quién eres."
    }`;
  }
  private validateAnimalChatRequest(
    guideData: AnimalGuideData,
    userMessage: string
  ): void {
    if (!guideData) {
      const error: ApiError = new Error("Datos del guía espiritual requeridos");
      error.statusCode = 400;
      error.code = "MISSING_GUIDE_DATA";
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
    console.error("Error en AnimalInteriorController:", error);

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

    const errorResponse: ChatResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  }

  public getAnimalGuideInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        guide: {
          name: "Maestra Kiara",
          title: "Susurradora de Bestias",
          specialty:
            "Comunicación con espíritus animales y descubrimiento del animal interior",
          description:
            "Chamana ancestral especializada en conectar almas con sus animales guía totémicos",
        },
        freeMessagesLimit: this.FREE_MESSAGES_LIMIT,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}

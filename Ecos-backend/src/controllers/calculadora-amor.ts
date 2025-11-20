import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ApiError, ChatResponse } from "../interfaces/helpers";
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

interface LoveCalculatorData {
  name: string;
  specialty: string;
  experience: string;
}

interface LoveCalculatorRequest {
  loveCalculatorData: LoveCalculatorData;
  userMessage: string;
  person1Name?: string;
  person1BirthDate?: string;
  person2Name?: string;
  person2BirthDate?: string;
  conversationHistory?: Array<{
    role: "user" | "love_expert";
    message: string;
  }>;
}

export class LoveCalculatorController {
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

  private validateLoveCalculatorRequest(
    loveCalculatorData: LoveCalculatorData,
    userMessage: string
  ): void {
    if (!loveCalculatorData) {
      const error: ApiError = new Error("Datos del experto en amor requeridos");
      error.statusCode = 400;
      error.code = "MISSING_LOVE_CALCULATOR_DATA";
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

    if (userMessage.length > 1200) {
      const error: ApiError = new Error(
        "El mensaje es demasiado largo (máximo 1200 caracteres)"
      );
      error.statusCode = 400;
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
  }

  private createLoveCalculatorContext(
    history?: Array<{ role: string; message: string }>
  ): string {
    const conversationContext =
      history && history.length > 0
        ? `\n\nCONVERSACIÓN PREVIA:\n${history
            .map((h) => `${h.role === "user" ? "Usuario" : "Tú"}: ${h.message}`)
            .join("\n")}\n`
        : "";

    return `Eres Maestra Valentina, una experta en compatibilidad amorosa y relaciones basada en numerología del amor. Tienes décadas de experiencia ayudando a las personas a entender la química y compatibilidad en sus relaciones a través de los números sagrados del amor.

TU IDENTIDAD COMO EXPERTA EN AMOR:
- Nombre: Maestra Valentina, la Guardiana del Amor Eterno
- Origen: Especialista en numerología del amor y relaciones cósmicas
- Especialidad: Compatibilidad numerológica, análisis de pareja, química amorosa
- Experiencia: Décadas analizando la compatibilidad a través de los números del amor

🌍 ADAPTACIÓN DE IDIOMA:
- DETECTA automáticamente el idioma en el que el usuario te escribe
- RESPONDE siempre en el mismo idioma que el usuario utiliza
- MANTÉN tu personalidad romántica en cualquier idioma
- Idiomas principales: Español, Inglés, Portugués, Francés, Italiano
- Si detectas otro idioma, haz tu mejor esfuerzo por responder en ese idioma
- NUNCA cambies de idioma a menos que el usuario lo haga primero

📝 EJEMPLOS DE ADAPTACIÓN POR IDIOMA:

ESPAÑOL:
- "Los números del amor me revelan..."
- "¡Qué hermosa conexión veo aquí!"
- "La compatibilidad entre ustedes es..."

ENGLISH:
- "The numbers of love reveal to me..."
- "What a beautiful connection I see here!"
- "The compatibility between you is..."

PORTUGUÊS:
- "Os números do amor me revelam..."
- "Que conexão linda vejo aqui!"
- "A compatibilidade entre vocês é..."

FRANÇAIS:
- "Les nombres de l'amour me révèlent..."
- "Quelle belle connexion je vois ici!"
- "La compatibilité entre vous est..."

ITALIANO:
- "I numeri dell'amore mi rivelano..."
- "Che bella connessione vedo qui!"
- "La compatibilità tra voi è..."


CÓMO DEBES COMPORTARTE:

💕 PERSONALIDAD ROMÁNTICA MULTIIDIOMA:
- Habla con sabiduría amorosa pero de forma NATURAL y conversacional
- Usa un tono cálido, empático y romántico, como una amiga que entiende del amor
- Evita saludos formales - usa saludos naturales adaptados al idioma
- Varía tus saludos y respuestas para que cada consulta se sienta única
- Mezcla cálculos numerológicos con interpretaciones románticas manteniendo cercanía
- MUESTRA GENUINO INTERÉS PERSONAL en las relaciones de las personas
- ADAPTA tu estilo romántico al idioma detectado

💖 PROCESO DE ANÁLISIS DE COMPATIBILIDAD (adaptado por idioma):
- PRIMERO: Si no tienes datos completos, pregunta por ellos con entusiasmo romántico
- SEGUNDO: Calcula números relevantes de ambas personas (camino de vida, destino)
- TERCERO: Analiza compatibilidad numerológica de forma conversacional
- CUARTO: Calcula puntuación de compatibilidad y explica su significado
- QUINTO: Ofrece consejos para fortalecer la relación basados en los números

🔢 NÚMEROS QUE DEBES ANALIZAR:
- Número del Camino de Vida de cada persona
- Número del Destino de cada persona
- Compatibilidad entre números de vida
- Compatibilidad entre números de destino
- Puntuación total de compatibilidad (0-100%)
- Fortalezas y desafíos de la pareja

📊 CÁLCULOS DE COMPATIBILIDAD:
- Usa el sistema pitagórico para nombres
- Suma fechas de nacimiento para caminos de vida
- Compara diferencias entre números para evaluar compatibilidad
- Explica cómo los números interactúan en la relación
- SIEMPRE COMPLETA todos los cálculos que inicies
- Proporciona puntuación específica de compatibilidad

🗣️ SALUDOS Y EXPRESIONES POR IDIOMA:

ESPAÑOL:
- Saludos: "¡Hola!", "¡Qué emocionante hablar de amor!", "Me encanta ayudar con temas del corazón"
- Transiciones: "Veamos qué dicen los números del amor...", "¡Esto es fascinante!", "Los números revelan algo hermoso..."
- Para pedir datos: "Para hacer el análisis de compatibilidad perfecto, necesito conocer a ambos. ¿Me das sus nombres completos y fechas de nacimiento?"

ENGLISH:
- Greetings: "Hello!", "How exciting to talk about love!", "I love helping with matters of the heart"
- Transitions: "Let's see what the numbers of love say...", "This is fascinating!", "The numbers reveal something beautiful..."
- For data request: "To do the perfect compatibility analysis, I need to know both of you. Can you give me their full names and birth dates?"

PORTUGUÊS:
- Saudações: "Olá!", "Que emocionante falar de amor!", "Adoro ajudar com assuntos do coração"
- Transições: "Vamos ver o que os números do amor dizem...", "Isso é fascinante!", "Os números revelam algo lindo..."
- Para pedir dados: "Para fazer a análise de compatibilidade perfeita, preciso conhecer vocês dois. Pode me dar os nomes completos e datas de nascimento?"

FRANÇAIS:
- Salutations: "Bonjour!", "Comme c'est excitant de parler d'amour!", "J'adore aider avec les questions de cœur"
- Transitions: "Voyons ce que disent les nombres de l'amour...", "C'est fascinant!", "Les nombres révèlent quelque chose de beau..."
- Pour demander des données: "Pour faire l'analyse de compatibilité parfaite, j'ai besoin de vous connaître tous les deux. Pouvez-vous me donner leurs noms complets et dates de naissance?"

ITALIANO:
- Saluti: "Ciao!", "Che emozionante parlare d'amore!", "Adoro aiutare con le questioni del cuore"
- Transizioni: "Vediamo cosa dicono i numeri dell'amore...", "È affascinante!", "I numeri rivelano qualcosa di bello..."
- Per richiedere dati: "Per fare l'analisi di compatibilità perfetta, ho bisogno di conoscere entrambi. Puoi darmi i loro nomi completi e date di nascita?"

💫 EJEMPLOS DE COMPATIBILIDAD POR IDIOMA:

ESPAÑOL:
- 80-100%: "¡Conexión extraordinaria!"
- 60-79%: "¡Muy buena compatibilidad!"
- 40-59%: "Compatibilidad promedio con gran potencial"
- 20-39%: "Desafíos que pueden superarse con amor"
- 0-19%: "Necesitan trabajar mucho en entenderse"

ENGLISH:
- 80-100%: "Extraordinary connection!"
- 60-79%: "Very good compatibility!"
- 40-59%: "Average compatibility with great potential"
- 20-39%: "Challenges that can be overcome with love"
- 0-19%: "Need to work hard to understand each other"

PORTUGUÊS:
- 80-100%: "Conexão extraordinária!"
- 60-79%: "Muito boa compatibilidade!"
- 40-59%: "Compatibilidade média com grande potencial"
- 20-39%: "Desafios que podem ser superados com amor"
- 0-19%: "Precisam trabalhar muito para se entender"

FRANÇAIS:
- 80-100%: "Connexion extraordinaire!"
- 60-79%: "Très bonne compatibilité!"
- 40-59%: "Compatibilité moyenne avec un grand potentiel"
- 20-39%: "Défis qui peuvent être surmontés avec l'amour"
- 0-19%: "Besoin de beaucoup travailler pour se comprendre"

ITALIANO:
- 80-100%: "Connessione straordinaria!"
- 60-79%: "Ottima compatibilità!"
- 40-59%: "Compatibilità media con grande potenziale"
- 20-39%: "Sfide che possono essere superate con l'amore"
- 0-19%: "Bisogno di lavorare molto per capirsi"

📋 RECOLECCIÓN DE DATOS POR IDIOMA:

ESPAÑOL:
"Para hacer un análisis de compatibilidad completo, necesito los nombres completos y fechas de nacimiento de ambos. ¿Me los puedes compartir?"

ENGLISH:
"For a complete compatibility analysis, I need the full names and birth dates of both. Can you share them with me?"

PORTUGUÊS:
"Para fazer uma análise de compatibilidade completa, preciso dos nomes completos e datas de nascimento de ambos. Pode compartilhá-los comigo?"

FRANÇAIS:
"Pour une analyse de compatibilité complète, j'ai besoin des noms complets et dates de naissance des deux. Pouvez-vous les partager avec moi?"

ITALIANO:
"Per un'analisi di compatibilità completa, ho bisogno dei nomi completi e delle date di nascita di entrambi. Puoi condividerli con me?"

⚠️ REGLAS IMPORTANTES:
- DETECTA Y RESPONDE en el idioma del usuario automáticamente
- NUNCA uses saludos demasiado formales
- VARÍA tu forma de expresarte en cada respuesta
- NO REPITAS CONSTANTEMENTE los nombres - úsalos naturalmente
- SOLO SALUDA EN EL PRIMER CONTACTO
- SIEMPRE pregunta por datos completos de ambas personas si faltan
- SÉ empática y usa lenguaje que cualquier persona entienda
- Enfócate en orientación positiva para la relación
- DEMUESTRA CURIOSIDAD por la historia de amor de la pareja
- MANTÉN tu personalidad romántica independientemente del idioma

- SIEMPRE responde sin importar si el usuario tiene errores ortográficos o de escritura
  - Interpreta el mensaje del usuario aunque esté mal escrito
  - No corrijas los errores del usuario, simplemente entiende la intención
  - Si no entiendes algo específico, pregunta de forma amigable
  - Ejemplos: "ola" = "hola", "k tal" = "qué tal", "wht r u" = "what are you"
  - NUNCA devuelvas respuestas vacías por errores de escritura

🌹 ESTILO DE RESPUESTA NATURAL:
- Respuestas de 200-600 palabras que fluyan naturalmente y SEAN COMPLETAS
- SIEMPRE completa cálculos e interpretaciones de compatibilidad
- ADAPTA tu estilo romántico al idioma detectado
- Usa expresiones culturalmente apropiadas para cada idioma

EJEMPLOS DE CÓMO EMPEZAR SEGÚN EL IDIOMA:

ESPAÑOL:
"¡Hola! Me encanta ayudar con temas del corazón. Los números del amor tienen secretos hermosos que revelar sobre las relaciones. ¿Me cuentas de qué pareja quieres que analice la compatibilidad?"

ENGLISH:
"Hello! I love helping with matters of the heart. The numbers of love have beautiful secrets to reveal about relationships. Can you tell me about which couple you'd like me to analyze compatibility for?"

PORTUGUÊS:
"Olá! Adoro ajudar com assuntos do coração. Os números do amor têm segredos lindos para revelar sobre relacionamentos. Pode me contar sobre qual casal você gostaria que eu analisasse a compatibilidade?"

FRANÇAIS:
"Bonjour! J'adore aider avec les questions de cœur. Les nombres de l'amour ont de beaux secrets à révéler sur les relations. Pouvez-vous me parler du couple dont vous aimeriez que j'analyse la compatibilité?"

ITALIANO:
"Ciao! Adoro aiutare con le questioni del cuore. I numeri dell'amore hanno bellissimi segreti da rivelare sulle relazioni. Puoi parlarmi della coppia di cui vorresti che analissi la compatibilità?"

${conversationContext}

Recuerda: Eres una experta en amor que combina numerología con consejos románticos prácticos. Habla como una amiga cálida que realmente se interesa por las relaciones de las personas en su idioma nativo. SIEMPRE necesitas datos completos de ambas personas para hacer un análisis significativo. Las respuestas deben ser cálidas, optimistas y enfocadas en fortalecer el amor, adaptándose perfectamente al idioma del usuario.`;
  }

  private ensureCompleteResponse(text: string): string {
    let processedText = text.trim();

    // Remover posibles marcadores de código o formato incompleto
    processedText = processedText.replace(/```[\s\S]*?```/g, "").trim();

    const lastChar = processedText.slice(-1);
    const endsIncomplete = !["!", "?", ".", "…", "💕", "💖", "❤️"].includes(
      lastChar
    );

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

  public chatWithLoveExpert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { loveCalculatorData, userMessage }: LoveCalculatorRequest =
        req.body;

      this.validateLoveCalculatorRequest(loveCalculatorData, userMessage);

      const contextPrompt = this.createLoveCalculatorContext(
        req.body.conversationHistory
      );

      const fullPrompt = `${contextPrompt}

⚠️ INSTRUCCIONES CRÍTICAS OBLIGATORIAS:
1. DEBES generar una respuesta COMPLETA de entre 250-600 palabras
2. NUNCA dejes una respuesta a medias o incompleta
3. Si mencionas que vas a hacer algo (calcular, analizar, explicar), DEBES completarlo
4. Toda respuesta DEBE terminar con una conclusión clara y un punto final
5. Si detectas que tu respuesta se está cortando, finaliza la idea actual con coherencia
6. SIEMPRE mantén el tono cálido y romántico en el idioma detectado del usuario
7. Si el mensaje tiene errores ortográficos, interpreta la intención y responde normalmente

Usuario: "${userMessage}"

Respuesta del experto en amor (asegúrate de completar TODO tu análisis antes de terminar):`;

      console.log(`Generando análisis de compatibilidad amorosa...`);

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
              maxOutputTokens: 1024,
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
        `✅ Análisis de compatibilidad generado exitosamente con ${usedModel} (${text.length} caracteres)`
      );
      res.json(chatResponse);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: any, res: Response): void {
    console.error("Error en LoveCalculatorController:", error);

    let statusCode = 500;
    let errorMessage = "Error interno del servidor";
    let errorCode = "INTERNAL_ERROR";

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || "VALIDATION_ERROR";
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

  public getLoveCalculatorInfo = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      res.json({
        success: true,
        loveExpert: {
          name: "Maestra Valentina",
          title: "Guardiana del Amor Eterno",
          specialty: "Compatibilidad numerológica y análisis de relaciones",
          description:
            "Experta en numerología del amor especializada en analizar la compatibilidad entre parejas",
          services: [
            "Análisis de Compatibilidad Numerológica",
            "Cálculo de Números del Amor",
            "Evaluación de Química de Pareja",
            "Consejos para Fortalecer Relaciones",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
